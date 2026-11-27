import Fastify, { type FastifyInstance } from 'fastify';
import { Counter, Histogram, Registry } from 'prom-client';

// Same shape as services/api/src/metrics.ts. Services cannot import each
// other (ADR 0008), and this is small enough that a shared package would cost
// more than the copy.

export const RecordOutcome = {
  Accepted: 'accepted',
  /** Already stored under the same msg_id: a retry, not an error. */
  Duplicate: 'duplicate',
  Rejected: 'rejected',
} as const;
export type RecordOutcome = (typeof RecordOutcome)[keyof typeof RecordOutcome];

export interface IngestMetrics {
  registry: Registry;
  requestDuration: Histogram<'method' | 'route' | 'status_code'>;
  records: Counter<'outcome'>;
}

const UNMATCHED_ROUTE = 'unmatched';

export function createMetrics(): IngestMetrics {
  const registry = new Registry();
  const records = new Counter({
    name: 'fwcoach_ingest_records_total',
    help: 'Log records received, by what happened to them.',
    labelNames: ['outcome'],
    registers: [registry],
  });
  // Zero series exist from the start, so a rate() over them is defined before the first upload.
  for (const outcome of Object.values(RecordOutcome)) records.inc({ outcome }, 0);
  return {
    registry,
    records,
    requestDuration: new Histogram({
      name: 'http_server_request_duration_seconds',
      help: 'HTTP request duration by route template. The _count series is the request count.',
      labelNames: ['method', 'route', 'status_code'],
      registers: [registry],
    }),
  };
}

export function observeRequests(app: FastifyInstance, metrics: IngestMetrics): void {
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

/** Its own listener, bound by config.ts, so /metrics is never on the ingest port. */
export function buildMetricsApp(registry: Registry): FastifyInstance {
  const app = Fastify({ logger: false });
  app.get('/metrics', async (_request, reply) =>
    reply.type(registry.contentType).send(await registry.metrics()),
  );
  return app;
}
