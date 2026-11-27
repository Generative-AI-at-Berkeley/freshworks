import { LOG_REDACT_CENSOR, LOG_REDACT_PATHS } from '@fwcoach/contracts';
import { pino, type DestinationStream } from 'pino';

import type { CollectorConfig } from './config.js';

/**
 * Structured logs to stderr, which launchd captures. Keys that could hold a
 * secret or content are redacted as a backstop. The real rule is to never pass
 * a token, request body or event payload to the logger at all.
 */
export function createLogger(
  level: CollectorConfig['logLevel'] = 'info',
  destination: DestinationStream = pino.destination(2),
) {
  return pino(
    {
      name: 'fwcoach',
      level,
      redact: { paths: [...LOG_REDACT_PATHS], censor: LOG_REDACT_CENSOR },
    },
    destination,
  );
}
export type Logger = ReturnType<typeof createLogger>;
