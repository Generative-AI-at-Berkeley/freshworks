import Fastify, { type FastifyInstance } from 'fastify';
import type pg from 'pg';

import type { ApiConfig } from './config.js';
import { v1 } from './routes/v1.js';

export interface AppOptions {
  pool: pg.Pool;
  authMode: ApiConfig['authMode'];
  logger?: boolean;
}

export function buildApp({ pool, authMode, logger = true }: AppOptions): FastifyInstance {
  const app = Fastify({ logger });

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
