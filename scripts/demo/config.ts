import { z } from 'zod';

/**
 * The only place the demo script reads the environment. The port variables
 * are the same ones docker-compose.yml reads, so a remapped port moves both
 * the container and the URL the script probes.
 */
export const DemoConfig = z.object({
  postgresPort: z.coerce.number().int().default(5432),
  ingestPort: z.coerce.number().int().default(4318),
  apiPort: z.coerce.number().int().default(8080),
  dashboardPort: z.coerce.number().int().default(3000),
  /** Seed for the synthetic org and traffic. Same seed, same data. */
  seed: z.coerce.number().int().default(1),
});
export type DemoConfig = z.infer<typeof DemoConfig>;

/** What child processes inherit, so docker compose reads the same port variables. */
export function inheritedEnv(): NodeJS.ProcessEnv {
  return { ...process.env };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): DemoConfig {
  const parsed = DemoConfig.safeParse({
    postgresPort: env['POSTGRES_PORT'],
    ingestPort: env['INGEST_PORT'],
    apiPort: env['API_PORT'],
    dashboardPort: env['DASHBOARD_PORT'],
    seed: env['DEMO_SEED'],
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid demo config. Check the *_PORT and DEMO_SEED variables.\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}
