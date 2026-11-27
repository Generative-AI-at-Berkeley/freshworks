import { z } from 'zod';

/** The only place ingest-mock reads the environment. */
export const IngestConfig = z.object({
  port: z.coerce.number().int().default(4318),
  /** Service user, not the owner. Unset means in-memory storage. TODO(BE-1): use it. */
  databaseUrl: z.string().startsWith('postgres').optional(),
  /** /metrics listener. Localhost by default, so it is never on the public interface. */
  metricsHost: z.string().min(1).default('127.0.0.1'),
  metricsPort: z.coerce.number().int().default(9465),
});
export type IngestConfig = z.infer<typeof IngestConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): IngestConfig {
  const parsed = IngestConfig.safeParse({
    port: env['INGEST_PORT'],
    databaseUrl: env['APP_DATABASE_URL'],
    metricsHost: env['INGEST_METRICS_HOST'],
    metricsPort: env['INGEST_METRICS_PORT'],
  });
  if (!parsed.success) throw new Error(`Invalid ingest config.\n${z.prettifyError(parsed.error)}`);
  return parsed.data;
}
