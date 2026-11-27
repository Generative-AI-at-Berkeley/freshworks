import { setTimeout as sleep } from 'node:timers/promises';

import type { TelemetryEvent } from '@fwcoach/contracts';

import type { HarnessAdapter, Observation } from './adapters/types.js';
import type { EventBuffer } from './buffer/types.js';
import type { CollectorConfig } from './config.js';
import type { Logger } from './logger.js';
import { normalize } from './normalize/normalizer.js';
import { applyPolicy } from './policy/content-level.js';
import type { Uploader } from './upload/uploader.js';

export interface DaemonDeps {
  config: CollectorConfig;
  adapters: HarnessAdapter[];
  buffer: EventBuffer;
  uploader: Uploader;
  logger: Logger;
  agentVersion: string;
  deviceId: string;
}

export interface CollectStats {
  buffered: number;
  /** Observations that failed normalization or the policy check. */
  dropped: number;
}

/**
 * One collection pass: every adapter, then normalize, then policy, then buffer.
 *
 * Failures are contained at two levels. An adapter that throws is skipped for
 * this pass, so one broken harness does not stop the others. A single bad
 * observation is dropped and counted, so one malformed record cannot stop its
 * harness from reporting forever once cursors persist.
 *
 * TODO(AG-1): persist each adapter's cursor in stateDir and pass it back as
 * `since`, so a pass only reads new data. Save the cursor after the buffer
 * append succeeds, never before. Put the dropped count in daemon_heartbeat.
 */
export async function collectOnce(deps: DaemonDeps, signal: AbortSignal): Promise<CollectStats> {
  const stats: CollectStats = { buffered: 0, dropped: 0 };
  for (const adapter of deps.adapters) {
    if (signal.aborted) break;
    try {
      const detected = await adapter.detect();
      for (const warning of detected.warnings) {
        deps.logger.warn({ harness: adapter.harness }, warning);
      }
      if (!detected.installed) continue;

      const { observations } = await adapter.collect({ since: undefined, signal });
      const events: TelemetryEvent[] = [];
      for (const obs of observations) {
        const event = toSendable(deps, adapter, obs);
        if (event === null) stats.dropped++;
        else events.push(event);
      }
      await deps.buffer.append(events);
      stats.buffered += events.length;
    } catch (error) {
      deps.logger.error({ harness: adapter.harness, err: error }, 'collection failed');
    }
  }
  return stats;
}

function toSendable(
  deps: DaemonDeps,
  adapter: HarnessAdapter,
  obs: Observation,
): TelemetryEvent | null {
  // Log the type and reason only. Never the observation: it is what we are
  // refusing to send.
  try {
    const result = applyPolicy(
      normalize(obs, {
        harness: adapter.harness,
        harnessVersion: null,
        agentVersion: deps.agentVersion,
        deviceId: deps.deviceId,
      }),
      deps.config.contentLevel,
    );
    if (result.action === 'send') return result.event;
    deps.logger.warn({ harness: adapter.harness, type: obs.type }, result.reason);
  } catch {
    deps.logger.warn({ harness: adapter.harness, type: obs.type }, 'observation failed validation');
  }
  return null;
}

/**
 * Uploads one batch from the buffer.
 *
 * TODO(AG-1): loop until the buffer is empty or the server pushes back, and
 * handle every UploadOutcome (see upload/uploader.ts): ack on accepted,
 * partial and rejected_request; split on too_large; stop and wait on
 * rate_limited; back off with jitter on retryable; stop on unauthorized.
 * Emit daemon_heartbeat with buffer stats.
 */
export async function flushOnce(deps: DaemonDeps): Promise<void> {
  const batch = await deps.buffer.peek({ maxEvents: 500, maxBytes: 1_000_000 });
  if (batch.length === 0) return;
  const outcome = await deps.uploader.upload(batch);
  if (outcome.kind === 'accepted') await deps.buffer.ack(batch.map((e) => e.event_id));
}

/**
 * The long-running loop launchd starts. Collects and flushes every
 * flushIntervalSeconds until the signal aborts (SIGTERM on shutdown).
 */
export async function runDaemon(deps: DaemonDeps, signal: AbortSignal): Promise<void> {
  const intervalMs = deps.config.flushIntervalSeconds * 1000;
  while (!signal.aborted) {
    await collectOnce(deps, signal);
    try {
      await flushOnce(deps);
    } catch (error) {
      deps.logger.error({ err: error }, 'flush failed, events stay buffered');
    }
    try {
      // Rejects immediately if the signal is already aborted, so a SIGTERM
      // during a pass never waits out the interval.
      await sleep(intervalMs, undefined, { signal });
    } catch {
      break;
    }
  }
}
