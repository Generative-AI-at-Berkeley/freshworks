import { z } from 'zod';

const millis = z.coerce.number().int().nonnegative();

/** HTTP server timeouts, same meaning as the API's (services/api/src/config.ts). */
export const ServerTimeouts = z.object({
  requestTimeoutMs: millis.default(30_000),
  connectionTimeoutMs: millis.default(60_000),
  keepAliveTimeoutMs: millis.default(72_000),
});
export type ServerTimeouts = z.infer<typeof ServerTimeouts>;

/** The only place ingest-mock reads the environment. */
export const IngestConfig = z.object({
  port: z.coerce.number().int().default(4318),
  /** Service user, not the owner. Unset means in-memory storage. TODO(BE-1): use it. */
  databaseUrl: z.string().startsWith('postgres').optional(),
  /** /metrics listener. Localhost by default, so it is never on the public interface. */
  metricsHost: z.string().min(1).default('127.0.0.1'),
  metricsPort: z.coerce.number().int().default(9465),
  timeouts: ServerTimeouts,
  /** How long shutdown may take before the process exits anyway. */
  shutdownTimeoutMs: z.coerce.number().int().positive().default(10_000),
});
export type IngestConfig = z.infer<typeof IngestConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): IngestConfig {
  const parsed = IngestConfig.safeParse({
    port: env['INGEST_PORT'],
    databaseUrl: env['APP_DATABASE_URL'],
    metricsHost: env['INGEST_METRICS_HOST'],
    metricsPort: env['INGEST_METRICS_PORT'],
    timeouts: {
      requestTimeoutMs: env['INGEST_REQUEST_TIMEOUT_MS'],
      connectionTimeoutMs: env['INGEST_CONNECTION_TIMEOUT_MS'],
      keepAliveTimeoutMs: env['INGEST_KEEP_ALIVE_TIMEOUT_MS'],
    },
    shutdownTimeoutMs: env['INGEST_SHUTDOWN_TIMEOUT_MS'],
  });
  if (!parsed.success) throw new Error(`Invalid ingest config.\n${z.prettifyError(parsed.error)}`);
  return parsed.data;
}
