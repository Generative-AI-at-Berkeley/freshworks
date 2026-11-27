import { pino } from 'pino';

import type { CollectorConfig } from './config.js';

/**
 * Structured logs to stderr, which launchd captures. Keys that could hold a
 * secret or content are redacted as a backstop. The real rule is to never pass
 * a token, request body or event payload to the logger at all.
 */
export function createLogger(level: CollectorConfig['logLevel'] = 'info') {
  return pino(
    {
      name: 'fwcoach',
      level,
      redact: {
        paths: [
          'token',
          '*.token',
          'authorization',
          '*.authorization',
          'headers',
          'body',
          'payload',
        ],
        censor: '[redacted]',
      },
    },
    pino.destination(2),
  );
}
export type Logger = ReturnType<typeof createLogger>;
