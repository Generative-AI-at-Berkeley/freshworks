import { Gauge, Histogram, Registry } from 'prom-client';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import type pg from 'pg';

export interface ApiMetrics {
  registry: Registry;
  requestDuration: Histogram<'method' | 'route' | 'status_code'>;
}

/** Label for requests the router did not match, so a URL scan cannot add series. */
const UNMATCHED_ROUTE = 'unmatched';

/**
 * One registry per app, not prom-client's global one, so tests can build
 * several apps in one process. Pool gauges read the pool at scrape time.
 */
export function createMetrics(pool?: pg.Pool): ApiMetrics {
  const registry = new Registry();
  const requestDuration = new Histogram({
    name: 'http_server_request_duration_seconds',
    help: 'HTTP request duration by route template. The _count series is the request count.',
    labelNames: ['method', 'route', 'status_code'],
    registers: [registry],
  });
  if (pool) {
    const poolGauge = (name: string, help: string, read: () => number) =>
      new Gauge({
        name,
        help,
        registers: [registry],
        collect() {
          this.set(read());
        },
      });
    poolGauge(
      'fwcoach_pg_pool_total_connections',
      'Open Postgres connections.',
      () => pool.totalCount,
    );
    poolGauge(
      'fwcoach_pg_pool_idle_connections',
      'Idle Postgres connections.',
      () => pool.idleCount,
    );
    poolGauge(
      'fwcoach_pg_pool_waiting_clients',
      'Queries waiting for a free connection. Above zero for long means the pool is too small.',
      () => pool.waitingCount,
    );
  }
  return { registry, requestDuration };
}

/** Records every response under its route template, never the raw URL. */
export function observeRequests(app: FastifyInstance, metrics: ApiMetrics): void {
  app.addHook('onResponse', (request, reply, done) => {
    metrics.requestDuration.observe(
      {
        method: request.method,
        route: request.routeOptions.url ?? UNMATCHED_ROUTE,
        status_code: String(reply.statusCode),
      },
      reply.elapsedTime / 1000,
    );
    done();
  });
}

/**
 * /metrics lives on its own listener so it never shares the public port.
 * config.ts binds it to localhost unless told otherwise.
 */
export function buildMetricsApp(registry: Registry): FastifyInstance {
  const app = Fastify({ logger: false });
  app.get('/metrics', async (_request, reply) =>
    reply.type(registry.contentType).send(await registry.metrics()),
  );
  return app;
}
