import { z } from 'zod';

export const AuthMode = { Local: 'local', Oidc: 'oidc' } as const;
export type AuthMode = (typeof AuthMode)[keyof typeof AuthMode];

const LOCAL_AUTH_ENVS = new Set(['development', 'test']);

export const ApiConfig = z
  .object({
    databaseUrl: z.string().startsWith('postgres'),
    port: z.coerce.number().int().default(8080),
    authMode: z.enum([AuthMode.Local, AuthMode.Oidc]).default(AuthMode.Local),
    nodeEnv: z.string().default('development'),
    /** Explicit opt-in for header auth outside development and test, for the compose demo. */
    allowHeaderAuth: z.stringbool().default(false),
  })
  // `local` trusts a request header for identity. It exists so the dashboard
  // and e2e tests can run without an identity provider. It is allowed only
  // where nothing real can be reached: development, test, or an explicit
  // opt-in. An unknown or misspelled NODE_ENV does not count as safe.
  .refine(
    (c) => c.authMode !== AuthMode.Local || LOCAL_AUTH_ENVS.has(c.nodeEnv) || c.allowHeaderAuth,
    {
      error:
        'API_AUTH_MODE=local needs NODE_ENV=development or test, or API_ALLOW_HEADER_AUTH=true',
      path: ['authMode'],
    },
  );
export type ApiConfig = z.infer<typeof ApiConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = ApiConfig.safeParse({
    // APP_DATABASE_URL in .env, so the API never picks up dbmate's owner URL by accident.
    databaseUrl: env['APP_DATABASE_URL'],
    port: env['API_PORT'],
    authMode: env['API_AUTH_MODE'],
    nodeEnv: env['NODE_ENV'],
    allowHeaderAuth: env['API_ALLOW_HEADER_AUTH'],
  });
  if (!parsed.success) throw new Error(`Invalid API config.\n${z.prettifyError(parsed.error)}`);
  return parsed.data;
}
