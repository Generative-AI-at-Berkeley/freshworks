/**
 * pnpm test:load: synthetic collector traffic at peak fleet rate against
 * ingest, checked against the budgets in load.config.json. Exits 1 when a
 * budget is missed. See docs/runbooks/ingest-load.md.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createHistogram, type RecordableHistogram } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';

import {
  encodeBatch,
  eventId,
  OTLP_LOGS_PATH,
  TelemetryEvent,
  type OtlpLogsRequest,
} from '@fwcoach/contracts';
import { Pool } from 'undici';

import { CountCheck, loadConfig, type LoadConfig } from './config.js';

const AGENT_VERSION = 'load';

const RequestKind = { Valid: 'valid', Replay: 'replay', Invalid: 'invalid' } as const;
type RequestKind = (typeof RequestKind)[keyof typeof RequestKind];

interface Planned {
  kind: RequestKind;
  device: number;
  body: string;
  /** Records ingest should store as new, as duplicates, and reject. */
  fresh: number;
  replayed: number;
  invalid: number;
}

interface Outcome {
  ok: boolean;
  detail?: string;
}

const say = (line = ''): void => {
  process.stdout.write(`${line}\n`);
};

/** mulberry32: small, seedable, good enough to pick a mix. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const require = createRequire(import.meta.url);
const templates = ['sessionStart', 'token_usage', 'agent_invoked'].map((name) =>
  TelemetryEvent.parse(
    JSON.parse(
      readFileSync(require.resolve(`@fwcoach/contracts/fixtures/v2/${name}.json`), 'utf8'),
    ),
  ),
);

/** Fixture events under fresh IDs, so every run starts with nothing stored. */
function events(runId: string, device: number, batch: number, count: number): TelemetryEvent[] {
  const now = new Date().toISOString();
  return Array.from({ length: count }, (_, i) => {
    const template = templates[i % templates.length] as TelemetryEvent;
    const event = structuredClone(template);
    event.event_id = eventId('load', runId, device, batch, i);
    event.occurred_at = now;
    event.sent_at = now;
    event.device.device_id = `dev_LOAD${String(device).padStart(5, '0')}`;
    return event;
  });
}

function withInvalidRecord(request: OtlpLogsRequest): OtlpLogsRequest {
  // Valid base64 JSON that is not a delivery message, as e2e/ingest.e2e.test.ts sends.
  request.resourceLogs[0]?.scopeLogs[0]?.logRecords.push({
    timeUnixNano: '0',
    body: { bytesValue: Buffer.from('{}').toString('base64') },
  });
  return request;
}

function pickSize(config: LoadConfig, random: () => number): number {
  let roll = random();
  for (const size of config.profile.batchSizes) {
    roll -= size.share;
    if (roll < 0) return size.min + Math.floor(random() * (size.max - size.min + 1));
  }
  return config.profile.batchSizes.at(-1)?.max ?? 1;
}

/** Bearer tokens the way the e2e suite sends them. TODO(BE-1): real device credentials from the device flow. */
const token = (runId: string, device: number) => `Bearer load_${runId}_${String(device)}`;

function check(planned: Planned, status: number, body: string): Outcome {
  if (status !== 200) return { ok: false, detail: `HTTP ${String(status)}` };
  let parsed: { partialSuccess?: { rejectedLogRecords?: number } };
  try {
    parsed = JSON.parse(body) as typeof parsed;
  } catch {
    return { ok: false, detail: 'response is not JSON' };
  }
  const rejected = parsed.partialSuccess?.rejectedLogRecords ?? 0;
  return rejected === planned.invalid
    ? { ok: true }
    : { ok: false, detail: `rejected ${String(rejected)}, expected ${String(planned.invalid)}` };
}

const ms = (h: RecordableHistogram, p: number) => h.percentile(p) / 1e6;

async function main(): Promise<void> {
  const config = loadConfig();
  const { profile, budgets } = config;
  const duration = config.durationSeconds ?? profile.durationSeconds;
  const rps = (profile.devices / profile.flushIntervalSeconds) * profile.peakFactor;
  const total = Math.max(1, Math.round(rps * duration));
  const random = rng(config.seed);
  const runId = `${String(config.seed)}-${String(Date.now())}`;
  const url = new URL(config.ingestUrl);

  say(`ingest load test against ${url.origin}${OTLP_LOGS_PATH}`);
  say(
    `  ${String(profile.devices)} devices, one flush per ${String(profile.flushIntervalSeconds)} s, x${String(profile.peakFactor)} peak = ${rps.toFixed(1)} req/s for ${String(duration)} s (${String(total)} requests)`,
  );

  const pool = new Pool(url.origin, { connections: profile.maxInFlight });
  const send = async (auth: string, body: string) => {
    const res = await pool.request({
      method: 'POST',
      path: OTLP_LOGS_PATH,
      headers: { authorization: auth, 'content-type': 'application/json' },
      body,
    });
    return { status: res.statusCode, body: await res.body.text() };
  };

  // Before the preflight, so the log count window opens before any of our requests.
  const startedAt = new Date();
  // An empty batch is valid OTLP, so this works against the real pipeline too.
  const preflight = await send(
    token(runId, 0),
    JSON.stringify(encodeBatch([], { agentVersion: AGENT_VERSION })),
  ).catch((error: unknown) => ({ status: 0, body: String(error) }));
  if (preflight.status !== 200) {
    throw new Error(
      `Ingest did not accept an empty batch at ${url.origin} (${String(preflight.status)}). Start it with docker compose up -d --wait, or set INGEST_URL.`,
    );
  }

  const latency = {
    all: createHistogram(),
    [RequestKind.Valid]: createHistogram(),
    [RequestKind.Replay]: createHistogram(),
    [RequestKind.Invalid]: createHistogram(),
  };
  const sent = { [RequestKind.Valid]: 0, [RequestKind.Replay]: 0, [RequestKind.Invalid]: 0 };
  const expected = { inserted: 0, duplicates: 0, rejected: 0 };
  const failures: string[] = [];
  let validFailures = 0;
  let maxLagMs = 0;
  // Recent clean batches, so a replay resends what the same device sent before.
  const recent: Planned[] = [];

  const plan = (i: number): Planned => {
    const roll = random();
    const earlier = recent[Math.floor(random() * recent.length)];
    if (roll < profile.replayShare && earlier) {
      return { ...earlier, kind: RequestKind.Replay, fresh: 0, replayed: earlier.fresh };
    }
    const device = i % profile.devices;
    const batch = events(runId, device, i, pickSize(config, random));
    const invalid = roll < profile.replayShare + profile.invalidShare ? 1 : 0;
    const request = encodeBatch(batch, { agentVersion: AGENT_VERSION });
    const planned: Planned = {
      kind: invalid ? RequestKind.Invalid : RequestKind.Valid,
      device,
      body: JSON.stringify(invalid ? withInvalidRecord(request) : request),
      fresh: batch.length,
      replayed: 0,
      invalid,
    };
    if (!invalid) {
      recent.push(planned);
      if (recent.length > 100) recent.shift();
    }
    return planned;
  };

  const run = async (planned: Planned): Promise<void> => {
    const started = process.hrtime.bigint();
    let outcome: Outcome;
    try {
      const res = await send(token(runId, planned.device), planned.body);
      outcome = check(planned, res.status, res.body);
    } catch (error) {
      outcome = { ok: false, detail: error instanceof Error ? error.message : String(error) };
    }
    const elapsed = Number(process.hrtime.bigint() - started);
    latency.all.record(Math.max(1, elapsed));
    latency[planned.kind].record(Math.max(1, elapsed));
    sent[planned.kind]++;
    if (outcome.ok) {
      expected.inserted += planned.fresh;
      expected.duplicates += planned.replayed;
      expected.rejected += planned.invalid;
    } else {
      if (planned.kind !== RequestKind.Invalid) validFailures++;
      if (failures.length < 20) failures.push(`${planned.kind}: ${outcome.detail ?? ''}`);
    }
  };

  // Open model: requests go out on schedule, not when the last one returns,
  // so a slow server shows up as latency instead of as a lower request rate.
  const t0 = performance.now();
  const inFlight = new Set<Promise<void>>();
  for (let i = 0; i < total; i++) {
    const due = t0 + (i * 1000) / rps;
    const wait = due - performance.now();
    if (wait > 0) await sleep(wait);
    while (inFlight.size >= profile.maxInFlight) await Promise.race(inFlight);
    maxLagMs = Math.max(maxLagMs, performance.now() - due);
    const p = run(plan(i)).finally(() => inFlight.delete(p));
    inFlight.add(p);
  }
  await Promise.all(inFlight);
  const elapsedS = (performance.now() - t0) / 1000;
  await pool.close();

  const counted = config.countCheck === CountCheck.ComposeLogs ? composeCounts(startedAt) : null;

  const validSent = sent[RequestKind.Valid] + sent[RequestKind.Replay];
  const validErrorRate = validSent === 0 ? 0 : validFailures / validSent;
  const p95 = ms(latency.all, 95);
  const p99 = ms(latency.all, 99);
  const misses: string[] = [];
  if (p95 > budgets.p95Ms)
    misses.push(`p95 ${p95.toFixed(1)} ms is over the ${String(budgets.p95Ms)} ms budget`);
  if (p99 > budgets.p99Ms)
    misses.push(`p99 ${p99.toFixed(1)} ms is over the ${String(budgets.p99Ms)} ms budget`);
  if (validErrorRate > budgets.validErrorRate)
    misses.push(
      `${String(validFailures)} of ${String(validSent)} valid batches failed, budget is ${String(budgets.validErrorRate)}`,
    );
  const invalidFailures = failures.filter((f) => f.startsWith(RequestKind.Invalid)).length;
  if (invalidFailures > 0)
    misses.push(
      `${String(invalidFailures)} batches with a bad record were not answered with partialSuccess`,
    );
  if (counted) {
    for (const key of ['inserted', 'duplicates', 'rejected'] as const) {
      if (counted[key] !== expected[key])
        misses.push(
          `ingest logged ${String(counted[key])} ${key}, expected ${String(expected[key])}`,
        );
    }
  }

  const summary = {
    target: `${url.origin}${OTLP_LOGS_PATH}`,
    startedAt: startedAt.toISOString(),
    profile: { ...profile, durationSeconds: duration, requestsPerSecond: rps, seed: config.seed },
    achievedRequestsPerSecond: total / elapsedS,
    maxScheduleLagMs: maxLagMs,
    requests: sent,
    latencyMs: Object.fromEntries(
      Object.entries(latency).map(([name, h]) => [
        name,
        { p50: ms(h, 50), p95: ms(h, 95), p99: ms(h, 99), max: h.max / 1e6 },
      ]),
    ),
    validErrorRate,
    records: { expected, counted, countCheck: config.countCheck },
    budgets,
    failures,
    misses,
    pass: misses.length === 0,
  };
  mkdirSync(config.outDir, { recursive: true });
  const out = join(config.outDir, 'summary.json');
  writeFileSync(out, `${JSON.stringify(summary, null, 2)}\n`);

  say(
    `  sent ${String(sent.valid)} valid, ${String(sent.replay)} replays, ${String(sent.invalid)} with a bad record in ${elapsedS.toFixed(1)} s (${summary.achievedRequestsPerSecond.toFixed(1)} req/s)`,
  );
  for (const [name, l] of Object.entries(summary.latencyMs)) {
    say(
      `  ${name.padEnd(8)} p50 ${l.p50.toFixed(1)} ms, p95 ${l.p95.toFixed(1)} ms, p99 ${l.p99.toFixed(1)} ms, max ${l.max.toFixed(1)} ms`,
    );
  }
  say(
    `  records expected: ${String(expected.inserted)} stored, ${String(expected.duplicates)} duplicates, ${String(expected.rejected)} rejected`,
  );
  say(
    counted
      ? `  records counted:  ${String(counted.inserted)} stored, ${String(counted.duplicates)} duplicates, ${String(counted.rejected)} rejected`
      : '  records counted:  skipped (LOAD_COUNT_CHECK=none)',
  );
  for (const failure of failures) say(`  failed ${failure}`);
  say(`  results in ${out}`);
  if (misses.length > 0) {
    say('\nOver budget:');
    for (const miss of misses) say(`  ${miss}`);
    say('Budgets are in scripts/load/load.config.json. See docs/runbooks/ingest-load.md.');
    process.exitCode = 1;
    return;
  }
  say('\nWithin budget.');
}

/**
 * ingest-mock logs one `batch stored` line per request with what it stored.
 * Summing them is the only view of its in-memory store from outside.
 * TODO(BE-1): count app.ingest_msg and app.event rows instead, as e2e does.
 */
function composeCounts(since: Date): { inserted: number; duplicates: number; rejected: number } {
  const result = spawnSync(
    'docker',
    [
      'compose',
      'logs',
      '--no-color',
      '--no-log-prefix',
      '--since',
      since.toISOString(),
      'ingest-mock',
    ],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(
      `docker compose logs ingest-mock failed: ${result.stderr.trim()}. Run from the repo root with the stack up, or set LOAD_COUNT_CHECK=none.`,
    );
  }
  const counts = { inserted: 0, duplicates: 0, rejected: 0 };
  for (const line of result.stdout.split('\n')) {
    if (!line.includes('"batch stored"')) continue;
    const entry = JSON.parse(line) as Partial<typeof counts> & { time?: number };
    if ((entry.time ?? 0) < since.getTime()) continue;
    counts.inserted += entry.inserted ?? 0;
    counts.duplicates += entry.duplicates ?? 0;
    counts.rejected += entry.rejected ?? 0;
  }
  return counts;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
