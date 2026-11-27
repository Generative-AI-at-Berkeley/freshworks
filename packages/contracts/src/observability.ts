/**
 * Log and tracing conventions every process shares: the collector, both
 * services and the dashboard proxy. They live here because contracts is the
 * one workspace all of them may import (ADR 0008).
 */

/**
 * pino redact paths. A backstop only: the rule is to never hand the logger a
 * token, a request body or an event payload (AGENTS.md). Whole `headers`
 * objects go, which covers authorization, cookie and the X-Dev-* identity
 * headers wherever a header bag ends up. The named keys catch the same values
 * logged on their own. pino wildcards match one level, hence the `*.` copies.
 */
const SECRET_KEYS = [
  'authorization',
  'cookie',
  '["set-cookie"]',
  '["x-dev-engineer"]',
  '["x-dev-roles"]',
  'token',
  'accessToken',
  'refreshToken',
  'credential',
  'headers',
  'body',
  'payload',
  'requestBody',
  'responseBody',
] as const;

export const LOG_REDACT_PATHS: readonly string[] = SECRET_KEYS.flatMap((key) => {
  const nested = key.startsWith('[') ? `*${key}` : `*.${key}`;
  return [key, nested];
});

export const LOG_REDACT_CENSOR = '[redacted]';

/** Correlates a dashboard error, the proxy call and the API log line. */
export const REQUEST_ID_HEADER = 'x-request-id';

// UUIDs and other opaque IDs fit. Anything longer or with other characters
// is dropped, so a caller cannot inject text into log lines through it.
const REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

export function isRequestId(value: unknown): value is string {
  return typeof value === 'string' && REQUEST_ID.test(value);
}
