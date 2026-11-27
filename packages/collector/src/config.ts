import { z } from 'zod';

import { ContentLevel } from './policy/content-level.js';

/**
 * Collector configuration, and the only place the collector reads the
 * environment. Every Freshworks-specific value (ingest URL, where Jamf puts
 * the registration credential) arrives here at runtime from the environment
 * or the managed config the Jamf package installs. None of it is ever a
 * default in this file (ADR 0007).
 */
export const CollectorConfig = z.object({
  ingestUrl: z.url(),
  /** Buffer, cursors and credentials. Relative paths resolve against the working directory. */
  stateDir: z.string().min(1),
  /** The pipeline flushes every 5 minutes. Lower it only in tests. */
  flushIntervalSeconds: z.coerce.number().int().min(1).default(300),
  /** Oldest events are evicted past this, and evictions are counted in the heartbeat. */
  bufferMaxBytes: z.coerce
    .number()
    .int()
    .min(1024)
    .default(10 * 1024 * 1024),
  // L2 (prompt text) is not built and needs the privacy review first, so the
  // config refuses it outright rather than accepting it and dropping events.
  contentLevel: z.enum([ContentLevel.L0, ContentLevel.L1]).default(ContentLevel.L1),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /**
   * Bearer token for ingest-mock in local development. TODO(AG-1): replace
   * with the Jamf credential flow; then this is only for tests.
   */
  devToken: z.string().min(1).optional(),
});
export type CollectorConfig = z.infer<typeof CollectorConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): CollectorConfig {
  const parsed = CollectorConfig.safeParse({
    ingestUrl: env.FWCOACH_INGEST_URL,
    stateDir: env.FWCOACH_STATE_DIR,
    flushIntervalSeconds: env.FWCOACH_FLUSH_INTERVAL_SECONDS,
    bufferMaxBytes: env.FWCOACH_BUFFER_MAX_BYTES,
    contentLevel: env.FWCOACH_CONTENT_LEVEL,
    logLevel: env.FWCOACH_LOG_LEVEL,
    devToken: env.FWCOACH_DEV_TOKEN,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid collector config. Check FWCOACH_* variables.\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}
