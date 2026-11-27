import { z } from 'zod';

import { PersonRef, Range } from './common.js';

/**
 * `GET /v1/admin/access-log?from&to&subject&cursor`. Draft from X-3
 * (dashboard). BE-2 owns the final shape. Admins only.
 *
 * Every allowed view of an individual writes a row, so this is the record of
 * who looked at whom. Newest first; the order is time, not a metric.
 */
export const AccessLogEntry = z.strictObject({
  viewedAt: z.iso.datetime(),
  viewer: PersonRef,
  subject: PersonRef,
  /** The API route that was read, like `/v1/engineers/{id}`. */
  route: z.string(),
});
export type AccessLogEntry = z.infer<typeof AccessLogEntry>;

export const AccessLog = z.strictObject({
  range: Range,
  entries: z.array(AccessLogEntry),
  /** Entries in the range, across all pages. */
  total: z.number().int().nonnegative(),
  /** Pass back as `cursor` for the next page. Null on the last page. */
  nextCursor: z.string().nullable(),
});
export type AccessLog = z.infer<typeof AccessLog>;
