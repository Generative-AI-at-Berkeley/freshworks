import { readFileSync } from 'node:fs';

import { z } from 'zod';

/**
 * The only place the load test reads the environment. The profile and the
 * budgets live in load.config.json so a change to either is one reviewed
 * diff. docs/runbooks/ingest-load.md says where each number comes from.
 */

/** How the run proves replays were stored once. */
export const CountCheck = {
  /** Sum the `batch stored` lines ingest-mock logs. Works while BE-1 keeps events in memory. */
  ComposeLogs: 'compose-logs',
  /** HTTP answers only. For a target whose storage we cannot see. */
  None: 'none',
} as const;
export type CountCheck = (typeof CountCheck)[keyof typeof CountCheck];

const BatchSize = z.object({
  share: z.number().min(0).max(1),
  min: z.number().int().min(1),
  /** The collector's own cap is 500 events per batch (collector/src/daemon.ts). */
  max: z.number().int().max(500),
});

const LoadFile = z.object({
  profile: z.object({
    /** Assumed fleet size. No doc gives one yet. */
    devices: z.number().int().min(1),
    /** Each device uploads once per interval (collector config, 300 s). */
    flushIntervalSeconds: z.number().int().min(1),
    /** Peak over the steady rate, for laptops waking and flushing at once. */
    peakFactor: z.number().min(1),
    durationSeconds: z.number().int().min(1),
    /** Caps open requests, like a connection pool would. */
    maxInFlight: z.number().int().min(1),
    batchSizes: z
      .array(BatchSize)
      .min(1)
      .refine((sizes) => Math.abs(sizes.reduce((s, b) => s + b.share, 0) - 1) < 1e-9, {
        error: 'batchSizes shares must add up to 1',
      }),
    /** Share of requests that resend an earlier batch unchanged, as a collector retry does. */
    replayShare: z.number().min(0).max(1),
    /** Share of requests that carry one record ingest must reject. */
    invalidShare: z.number().min(0).max(1),
  }),
  budgets: z.object({
    p95Ms: z.number().positive(),
    p99Ms: z.number().positive(),
    /** Share of valid batches that may get anything but a clean 200. */
    validErrorRate: z.number().min(0).max(1),
  }),
});

export const LoadConfig = LoadFile.extend({
  /** Same variable as the e2e suite. Point it at the real pipeline later. */
  ingestUrl: z.url(),
  /** Overrides profile.durationSeconds for a quick local run. */
  durationSeconds: z.coerce.number().int().min(1).optional(),
  countCheck: z.enum([CountCheck.ComposeLogs, CountCheck.None]).default(CountCheck.ComposeLogs),
  outDir: z.string().min(1).default('load-results'),
  /** Same seed, same mix of batch sizes, replays and invalid records. */
  seed: z.coerce.number().int().default(1),
});
export type LoadConfig = z.infer<typeof LoadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): LoadConfig {
  const file: unknown = JSON.parse(
    readFileSync(new URL('./load.config.json', import.meta.url), 'utf8'),
  );
  const parsed = LoadConfig.safeParse({
    ...(file as object),
    ingestUrl: env['INGEST_URL'] ?? `http://localhost:${env['INGEST_PORT'] ?? '4318'}`,
    durationSeconds: env['LOAD_DURATION_SECONDS'],
    countCheck: env['LOAD_COUNT_CHECK'],
    outDir: env['LOAD_OUT_DIR'],
    seed: env['LOAD_SEED'],
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid load test config. Check scripts/load/load.config.json and the INGEST_URL, INGEST_PORT and LOAD_* variables.\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}
