import { createHash, randomUUID } from 'node:crypto';

import {
  decodeBatch,
  isRequestId,
  LOG_REDACT_CENSOR,
  LOG_REDACT_PATHS,
  OTLP_LOGS_PATH,
  OtlpLogsRequest,
  REQUEST_ID_HEADER,
} from '@fwcoach/contracts';
import Fastify, { type FastifyInstance } from 'fastify';

import { ServerTimeouts } from './config.js';
import { createMetrics, observeRequests, RecordOutcome, type IngestMetrics } from './metrics.js';
import { problem, useProblemHandlers } from './problem.js';
import type { EventStore } from './store/types.js';

export interface AppOptions {
  store: EventStore;
  /** Fastify logger setting. Tests pass false. */
  logger?: boolean;
  /** Where log lines go. Defaults to stdout. Tests pass a capture stream. */
  logStream?: { write(line: string): void };
  /** Defaults to a fresh registry, which main.ts then serves on the metrics port. */
  metrics?: IngestMetrics;
  /** Largest request body accepted, in bytes. TODO(BE-1): match the real pipeline once Freshworks shares it. */
  bodyLimit?: number;
  /** Defaults from config.ts when omitted. */
  timeouts?: ServerTimeouts;
}

/**
 * The mock pipeline. Response shapes follow OTLP/HTTP: 200 with an optional
 * `partialSuccess` when some records were rejected, 400 for a request that is
 * not OTLP at all, 401 without a bearer token, 429 with Retry-After.
 */
export function buildApp({
  store,
  logger = true,
  logStream,
  metrics = createMetrics(),
  bodyLimit = 5 * 1024 * 1024,
  timeouts = ServerTimeouts.parse({}),
}: AppOptions): FastifyInstance {
  const app = Fastify({
    logger: logger && {
      redact: { paths: [...LOG_REDACT_PATHS], censor: LOG_REDACT_CENSOR },
      ...(logStream && { stream: logStream }),
    },
    bodyLimit,
    ...serverTimeouts(timeouts),
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
  useProblemHandlers(app, 'No such route. The mock pipeline serves POST /v1/logs.');

  // Liveness: the process is up. Readiness: it can take a batch. Fastify
  // answers 503 by itself once close() starts, so a draining instance drops
  // out of rotation. TODO(BE-1): also check Postgres once PostgresEventStore lands.
  app.get('/healthz', () => ({ status: 'ok' }));
  app.get('/readyz', () => ({ status: 'ok' }));

  app.post(OTLP_LOGS_PATH, async (request, reply) => {
    const deviceId = authenticate(request.headers.authorization);
    if (deviceId === null) return problem(reply, 401, 'Missing or invalid bearer token.');

    // TODO(BE-1): per-device rate and burst limits. Answer 429 with a
    // Retry-After header in seconds, and test the collector against it.

    const parsed = OtlpLogsRequest.safeParse(request.body);
    if (!parsed.success) return problem(reply, 400, 'Body is not an OTLP JSON logs request.');

    const decoded = decodeBatch(parsed.data);
    const accepted = decoded.flatMap((r) => (r.ok ? [r.message] : []));
    const rejected = decoded.filter((r) => !r.ok);

    const result = await store.store(deviceId, accepted);
    request.log.info({ deviceId, ...result, rejected: rejected.length }, 'batch stored');
    metrics.records.inc({ outcome: RecordOutcome.Accepted }, result.inserted);
    metrics.records.inc({ outcome: RecordOutcome.Duplicate }, result.duplicates);
    metrics.records.inc({ outcome: RecordOutcome.Rejected }, rejected.length);

    return rejected.length === 0
      ? {}
      : {
          partialSuccess: {
            rejectedLogRecords: rejected.length,
            errorMessage: rejected.map((r) => `record ${r.index}: ${r.error}`).join('\n'),
          },
        };
  });

  // TODO(BE-1): mock the device flow the collector reuses (see
  // docs/contracts/ingest.md). Registration exchanges the Jamf-provisioned
  // credential for a device ID and a rotating credential; rotation issues the
  // next one before the current expires.
  app.post('/v1/devices/register', (_request, reply) =>
    problem(reply, 501, 'Not implemented (BE-1).'),
  );
  app.post('/v1/devices/credential', (_request, reply) =>
    problem(reply, 501, 'Not implemented (BE-1).'),
  );

  return app;
}

/**
 * TODO(BE-1): verify the rotating device credential and map it to the
 * engineer and device it was issued to. Until then any bearer token is
 * accepted, and the device ID is a hash of it. Never the token itself: the
 * device ID is logged and stored.
 */
function authenticate(header: string | undefined): string | null {
  const token = /^Bearer (\S+)$/.exec(header ?? '')?.[1];
  if (token === undefined) return null;
  return `dev_${createHash('sha256').update(token).digest('hex').slice(0, 16)}`;
}

function serverTimeouts(timeouts: ServerTimeouts) {
  return {
    requestTimeout: timeouts.requestTimeoutMs,
    connectionTimeout: timeouts.connectionTimeoutMs,
    keepAliveTimeout: timeouts.keepAliveTimeoutMs,
  };
}
