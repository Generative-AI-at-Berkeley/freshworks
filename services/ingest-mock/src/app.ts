import { createHash } from 'node:crypto';

import { decodeBatch, OTLP_LOGS_PATH, OtlpLogsRequest } from '@fwcoach/contracts';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';

import type { EventStore } from './store/types.js';

export interface AppOptions {
  store: EventStore;
  /** Fastify logger setting. Tests pass false. */
  logger?: boolean;
  /** Largest request body accepted, in bytes. TODO(BE-2): match the real pipeline once Freshworks shares it. */
  bodyLimit?: number;
}

/**
 * The mock pipeline. Response shapes follow OTLP/HTTP: 200 with an optional
 * `partialSuccess` when some records were rejected, 400 for a request that is
 * not OTLP at all, 401 without a bearer token, 429 with Retry-After.
 */
export function buildApp({
  store,
  logger = true,
  bodyLimit = 5 * 1024 * 1024,
}: AppOptions): FastifyInstance {
  const app = Fastify({ logger, bodyLimit });

  app.get('/healthz', () => ({ status: 'ok' }));

  app.post(OTLP_LOGS_PATH, async (request, reply) => {
    const deviceId = authenticate(request.headers.authorization);
    if (deviceId === null) return problem(reply, 401, 'Missing or invalid bearer token.');

    // TODO(BE-2): per-device rate and burst limits. Answer 429 with a
    // Retry-After header in seconds, and test the collector against it.

    const parsed = OtlpLogsRequest.safeParse(request.body);
    if (!parsed.success) return problem(reply, 400, 'Body is not an OTLP JSON logs request.');

    const decoded = decodeBatch(parsed.data);
    const accepted = decoded.flatMap((r) => (r.ok ? [r.message] : []));
    const rejected = decoded.filter((r) => !r.ok);

    const result = await store.store(deviceId, accepted);
    request.log.info({ deviceId, ...result, rejected: rejected.length }, 'batch stored');

    return rejected.length === 0
      ? {}
      : {
          partialSuccess: {
            rejectedLogRecords: rejected.length,
            errorMessage: rejected.map((r) => `record ${r.index}: ${r.error}`).join('\n'),
          },
        };
  });

  // TODO(BE-2): mock the device flow the collector reuses (see
  // docs/contracts/ingest.md). Registration exchanges the Jamf-provisioned
  // credential for a device ID and a rotating credential; rotation issues the
  // next one before the current expires.
  app.post('/v1/devices/register', (_request, reply) =>
    problem(reply, 501, 'Not implemented (BE-2).'),
  );
  app.post('/v1/devices/credential', (_request, reply) =>
    problem(reply, 501, 'Not implemented (BE-2).'),
  );

  return app;
}

/**
 * TODO(BE-2): verify the rotating device credential and map it to the
 * engineer and device it was issued to. Until then any bearer token is
 * accepted, and the device ID is a hash of it. Never the token itself: the
 * device ID is logged and stored.
 */
function authenticate(header: string | undefined): string | null {
  const token = /^Bearer (\S+)$/.exec(header ?? '')?.[1];
  if (token === undefined) return null;
  return `dev_${createHash('sha256').update(token).digest('hex').slice(0, 16)}`;
}

function problem(reply: FastifyReply, status: number, detail: string) {
  return reply.status(status).type('application/problem+json').send({ status, detail });
}
