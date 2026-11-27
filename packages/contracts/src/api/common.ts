import { z } from 'zod';

/**
 * Building blocks shared by every query API response (docs/api.md,
 * Conventions). They live here so the API and the dashboard parse the same
 * definition and a mismatch fails a test, not a demo.
 */

/** A UTC day, `YYYY-MM-DD`. */
export const Day = z.iso.date();

/** Share of the underlying data that was actually measured, 0 to 1. */
export const Coverage = z.number().min(0).max(1);

/**
 * A count the source may not record. `null` means not measured, which is
 * different from a measured zero (AGENTS.md, Collector).
 */
export const Measured = z.number().nonnegative().nullable();

/** Every cost carries its coverage. `costUsd` is null when nothing could be priced. */
export const Cost = z.strictObject({
  costUsd: z.number().nonnegative().nullable(),
  costCoverage: Coverage,
});

/**
 * How a per-person metric is spread across a group. Routes return this
 * instead of a list of people, so nothing can be read as a ranking (spec 8).
 */
export const Distribution = z.strictObject({
  p50: z.number().nullable(),
  p90: z.number().nullable(),
  buckets: z.array(
    z.strictObject({ from: z.number(), to: z.number(), engineers: z.number().int() }),
  ),
});

/** A person in a management chain, for breadcrumbs. */
export const PersonRef = z.strictObject({ id: z.string(), name: z.string() });

/** A date range as the API echoes it back: `from` inclusive, `to` exclusive. */
export const Range = z.strictObject({ from: Day, to: Day });

/**
 * The error body for every non-2xx response, `application/problem+json`
 * (RFC 9457). `type` and `title` are optional so a client still parses a body
 * from a service that only sends `status` and `detail`.
 */
export const Problem = z.looseObject({
  type: z.string().optional(),
  title: z.string().optional(),
  status: z.number().int(),
  detail: z.string(),
  /** Same value as the X-Request-ID response header and the server's log line. */
  requestId: z.string().optional(),
});
export type Problem = z.infer<typeof Problem>;

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

const STATUS_TITLES: Readonly<Record<number, string>> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  413: 'Content Too Large',
  415: 'Unsupported Media Type',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

/**
 * Builds the problem body every service and the dashboard proxy send. With
 * `type: about:blank` the title must be the status phrase (RFC 9457 4.2.1),
 * so callers only choose the status and the sentence in `detail`. The detail
 * is shown to people: say what broke and what to do, never internals.
 * `requestId` is the X-Request-ID of the request that failed, so a person can
 * quote it and an operator can find the log line.
 */
export function problem(status: number, detail: string, requestId?: string): Problem {
  const title = STATUS_TITLES[status] ?? (status >= 500 ? 'Server Error' : 'Client Error');
  return requestId === undefined
    ? { type: 'about:blank', title, status, detail }
    : { type: 'about:blank', title, status, detail, requestId };
}
