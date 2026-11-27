import { z } from 'zod';

import { HarnessSchema } from '../harness.js';
import { Cost, Day, Measured, Range } from './common.js';

/**
 * `GET /v1/me/data`. Draft from X-3 (dashboard). BE-2 owns the final shape.
 * Anyone, for themselves only.
 *
 * What fwcoach holds about the caller: their devices, their own totals, and
 * the event rows behind them. It is the answer to "what do you collect about
 * me", so it shows metadata only, never prompt or file content (spec 7.3).
 */
export const MyEvent = z.strictObject({
  occurredAt: z.iso.datetime(),
  harness: HarnessSchema,
  eventType: z.string(),
  sessionId: z.string().nullable(),
  /** Payload field names that were stored for this event, not their values. */
  fields: z.array(z.string()),
});
export type MyEvent = z.infer<typeof MyEvent>;

export const MyData = z.strictObject({
  engineer: z.strictObject({
    id: z.string(),
    name: z.string(),
    orgUnit: z.strictObject({ id: z.string(), name: z.string() }),
  }),
  range: Range,
  dataThrough: Day.nullable(),
  devices: z.array(
    z.strictObject({
      deviceId: z.string(),
      agentVersion: z.string().nullable(),
      firstSeenAt: z.iso.datetime(),
      lastSeenAt: z.iso.datetime(),
    }),
  ),
  /** The caller's own totals per harness, the same numbers managers see rolled up. */
  harnesses: z.array(
    z.strictObject({
      harness: HarnessSchema,
      activeDays: z.number().int().nonnegative(),
      sessions: z.number().int().nonnegative(),
      tokens: Measured,
      credits: Measured,
      cost: Cost,
    }),
  ),
  /** Most recent events first, one page. */
  events: z.array(MyEvent),
  /** Events in the range, across all pages. */
  totalEvents: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
  /** How long raw events are kept, in months (ADR 0006). */
  retentionMonths: z.number().int().positive(),
});
export type MyData = z.infer<typeof MyData>;
