import { z } from 'zod';

import { HarnessSchema } from '../harness.js';
import { Day, Range } from './common.js';

/**
 * `GET /v1/fleet/health`. Draft from X-3 (dashboard). BE-4 owns the final
 * shape; it reads `device`, `ingest_batch`, `ingest_rejection` and
 * `retention_run` (BE-1). Admins only.
 *
 * It answers "are collectors reporting, and is anything being dropped", so
 * it counts devices and uploads, never usage per person.
 */
export const RejectionReason = z.enum(['invalid_schema', 'not_base64', 'too_large']);
export type RejectionReason = z.infer<typeof RejectionReason>;

export const FleetHealth = z.strictObject({
  range: Range,
  /** Last day with finished batch counts. */
  dataThrough: Day.nullable(),
  devices: z.strictObject({
    /** Devices that have ever uploaded and whose owner has not departed. */
    total: z.number().int().nonnegative(),
    /** Uploaded at least once in the last 24 hours. */
    reportingLastDay: z.number().int().nonnegative(),
    /** No upload for 3 days or more. Listed in `quiet`. */
    quiet: z.number().int().nonnegative(),
  }),
  /** Collector versions in use, newest first. */
  agentVersions: z.array(
    z.strictObject({ version: z.string(), devices: z.number().int().nonnegative() }),
  ),
  /** One row per day in the range, from `ingest_batch`. */
  uploads: z.array(
    z.strictObject({
      day: Day,
      batches: z.number().int().nonnegative(),
      accepted: z.number().int().nonnegative(),
      duplicates: z.number().int().nonnegative(),
      rejected: z.number().int().nonnegative(),
    }),
  ),
  /** Records not stored, by reason, over the range. Never the payload. */
  rejections: z.array(
    z.strictObject({ reason: RejectionReason, count: z.number().int().nonnegative() }),
  ),
  /** Which harnesses each reporting device sent events for in the range. */
  harnesses: z.array(
    z.strictObject({ harness: HarnessSchema, devices: z.number().int().nonnegative() }),
  ),
  /** Devices with no upload for 3 days or more, sorted by owner name. */
  quietDevices: z.array(
    z.strictObject({
      deviceId: z.string(),
      owner: z.strictObject({ id: z.string(), name: z.string() }),
      agentVersion: z.string().nullable(),
      lastSeenAt: z.iso.datetime(),
    }),
  ),
  /** The most recent retention job (ADR 0006). Null before the first run. */
  lastRetentionRun: z
    .strictObject({
      ranAt: z.iso.datetime(),
      dryRun: z.boolean(),
      partitionsDropped: z.number().int().nonnegative(),
      rowsPurged: z.number().int().nonnegative(),
    })
    .nullable(),
});
export type FleetHealth = z.infer<typeof FleetHealth>;
