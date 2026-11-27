import { randomUUID } from 'node:crypto';

import helmet from '@fastify/helmet';
import {
  isRequestId,
  LOG_REDACT_CENSOR,
  LOG_REDACT_PATHS,
  REQUEST_ID_HEADER,
} from '@fwcoach/contracts';
import Fastify, { type FastifyInstance } from 'fastify';
import type pg from 'pg';

import { HttpLimits, type ApiConfig } from './config.js';
import { createMetrics, observeRequests, type ApiMetrics } from './metrics.js';
import { useProblemHandlers } from './problem.js';
import { v1 } from './routes/v1.js';

export interface AppOptions {
  pool: pg.Pool;
  authMode: ApiConfig['authMode'];
  logger?: boolean;
  /** Where log lines go. Defaults to stdout. Tests pass a capture stream. */
  logStream?: { write(line: string): void };
  /** Defaults to a fresh registry, which main.ts then serves on the metrics port. */
  metrics?: ApiMetrics;
  /** Defaults from config.ts when omitted. */
  limits?: HttpLimits;
}

export function buildApp({
  pool,
  authMode,
  logger = true,
  logStream,
  metrics = createMetrics(pool),
  limits = HttpLimits.parse({}),
}: AppOptions): FastifyInstance {
  const app = Fastify({
    logger: logger && {
      redact: { paths: [...LOG_REDACT_PATHS], censor: LOG_REDACT_CENSOR },
      ...(logStream && { stream: logStream }),
    },
    ...serverLimits(limits),
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

  // Only the dashboard's server calls this API, never a browser, so there is
  // no CORS plugin and no Access-Control-* header. JSON needs no CSP.
  void app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: limits.hsts ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  });
  useProblemHandlers(app, 'No such route. See docs/api.md for the paths this API serves.');

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

  void app.register(v1({ authMode, limits }), { prefix: '/v1' });
  return app;
}

function serverLimits(limits: HttpLimits) {
  return {
    bodyLimit: limits.bodyLimitBytes,
    requestTimeout: limits.requestTimeoutMs,
    connectionTimeout: limits.connectionTimeoutMs,
    keepAliveTimeout: limits.keepAliveTimeoutMs,
  };
}
