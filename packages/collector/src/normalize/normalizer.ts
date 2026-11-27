import { release } from 'node:os';

import {
  eventId,
  Harness,
  PipelineIde,
  SCHEMA_NAME,
  SCHEMA_VERSION,
  TelemetryEvent,
} from '@fwcoach/contracts';

import type { Observation } from '../adapters/types.js';

export interface NormalizeContext {
  harness: Harness;
  harnessVersion: string | null;
  agentVersion: string;
  deviceId: string;
  /** Set by the uploader at send time. Normalizing uses a placeholder. */
  sentAt?: string;
}

const pipelineIdes = new Set<string>(Object.values(PipelineIde));

/**
 * Observation -> v2 event. The one place shared blocks are filled, so every
 * adapter produces identical shapes (AG-2 owns this file).
 *
 * Harnesses the pipeline does not accept yet keep their real name in
 * `ext.fwcoach.harness`. Cursor Agent goes out as `cursor`. Kiro has no
 * accepted equivalent, so it goes out as `kiro`, which the real pipeline may
 * reject until the AG-4 field proposal is accepted. The mock accepts it.
 * TODO(AG-4): drop the fallback once Freshworks accepts kiro and cursor-agent.
 */
export function normalize(obs: Observation, ctx: NormalizeContext): TelemetryEvent {
  const ide = pipelineIdes.has(ctx.harness)
    ? ctx.harness
    : ctx.harness === Harness.CursorAgent
      ? Harness.Cursor
      : ctx.harness;

  const fwcoach = {
    ...(ide !== ctx.harness && { harness: ctx.harness }),
    ...(obs.subagent && {
      is_subagent: true,
      parent_session_id: obs.subagent.parentSessionId,
      subagent_id: obs.subagent.subagentId,
    }),
    ...(obs.credits && { credits: obs.credits }),
  };

  // Parse rather than cast: an adapter bug should fail here, on the machine,
  // with a clear message, not as a rejected record on the server.
  return TelemetryEvent.parse({
    schema: SCHEMA_NAME,
    schema_version: SCHEMA_VERSION,
    event_id: eventId(ctx.harness, obs.type, ...obs.sourceKey),
    event_type: obs.type,
    occurred_at: obs.occurredAt,
    sent_at: ctx.sentAt ?? obs.occurredAt,
    msg: obs.msg,
    source: {
      ide,
      ide_version: ctx.harnessVersion,
      surface: null,
      hook_version: null,
      agent_version: ctx.agentVersion,
    },
    device: {
      device_id: ctx.deviceId,
      machine_id: null,
      os: process.platform,
      os_version: release(),
    },
    session: {
      session_id: obs.session.sessionId,
      conversation_id: obs.session.conversationId ?? null,
      prompt_id: obs.session.promptId ?? null,
      source: obs.session.source ?? null,
    },
    model: {
      name: obs.model?.name ?? null,
      id: obs.model?.id ?? null,
      resolved: null,
      session: null,
    },
    repo: { name: obs.repoName ?? null },
    pdlc: { active: false },
    data: obs.data,
    ext: Object.keys(fwcoach).length > 0 ? { fwcoach } : {},
  });
}
