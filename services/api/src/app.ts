import { randomUUID } from 'node:crypto';

import {
  isRequestId,
  LOG_REDACT_CENSOR,
  LOG_REDACT_PATHS,
  REQUEST_ID_HEADER,
} from '@fwcoach/contracts';
import Fastify, { type FastifyInstance } from 'fastify';
import type pg from 'pg';

import type { ApiConfig } from './config.js';
import { createMetrics, observeRequests, type ApiMetrics } from './metrics.js';
import { problem, v1 } from './routes/v1.js';

export interface AppOptions {
  pool: pg.Pool;
  authMode: ApiConfig['authMode'];
  logger?: boolean;
  /** Where log lines go. Defaults to stdout. Tests pass a capture stream. */
  logStream?: { write(line: string): void };
  /** Defaults to a fresh registry, which main.ts then serves on the metrics port. */
  metrics?: ApiMetrics;
}

export function buildApp({
  pool,
  authMode,
  logger = true,
  logStream,
  metrics = createMetrics(pool),
}: AppOptions): FastifyInstance {
  const app = Fastify({
    logger: logger && {
      redact: { paths: [...LOG_REDACT_PATHS], censor: LOG_REDACT_CENSOR },
      ...(logStream && { stream: logStream }),
    },
    // The dashboard proxy sends its own ID so one error can be followed from
    // the page to this log. A malformed one is replaced, never logged.
    genReqId: (request) => {
      const inbound = request.headers[REQUEST_ID_HEADER];
      return isRequestId(inbound) ? inbound : randomUUID();
    },
  });

  app.addHook('onRequest', (request, reply, done) => {
    void reply.header(REQUEST_ID_HEADER, request.id);
    done();
  });
  observeRequests(app, metrics);

  app.setNotFoundHandler((_request, reply) => problem(reply, 404, 'No such API route.'));
  app.setErrorHandler((error: { statusCode?: number; message: string }, request, reply) => {
    const status =
      error.statusCode !== undefined && error.statusCode >= 400 ? error.statusCode : 500;
    if (status < 500) return problem(reply, status, error.message);
    request.log.error({ err: error }, 'request failed');
    return problem(
      reply,
      status,
      'The API failed on this request. Quote the request ID when reporting it.',
    );
  });

  // Liveness: the process is up. Readiness: it can reach Postgres.
  app.get('/healthz', () => ({ status: 'ok' }));
  app.get('/readyz', async (_request, reply) => {
    try {
      await pool.query('select 1');
      return { status: 'ok' };
    } catch {
      return reply.status(503).send({ status: 'unavailable' });
    }
  });

  void app.register(v1({ authMode }), { prefix: '/v1' });
  return app;
}
