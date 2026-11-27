/**
 * The only place in this app that reads process.env. Server only: the browser
 * calls this app's own /api routes, which hold the API address and the dev
 * identity, so none of it is ever bundled for the client.
 */
import 'server-only';

import { z } from 'zod';

import { ServerMode } from '@/config/enums';

const blankAsUndefined = (value: unknown) => (value === '' ? undefined : value);

const Env = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    /** The fwcoach query API. Blank runs the dashboard on built-in mock data. */
    API_BASE_URL: z.preprocess(blankAsUndefined, z.url().optional()),
    /**
     * Who the dashboard says you are, until OIDC sign-in lands (X-3, after
     * BE-2). Sent to the API as X-Dev-Engineer, which the API only accepts in
     * local auth mode.
     */
    DASHBOARD_DEV_ENGINEER: z.preprocess(blankAsUndefined, z.string().optional()),
    DASHBOARD_DEV_ORG_UNIT: z.preprocess(blankAsUndefined, z.string().optional()),
    DASHBOARD_DEV_ROLES: z.preprocess(blankAsUndefined, z.string().optional()),
    /** How long the proxy waits for the API before answering 504. */
    API_TIMEOUT_MS: z.preprocess(
      blankAsUndefined,
      z.coerce.number().int().positive().default(10_000),
    ),
    /** Mirrors API_ALLOW_HEADER_AUTH: lets `next start` use the dev identity, for the compose demo. */
    DASHBOARD_ALLOW_DEV_IDENTITY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .superRefine((env, ctx) => {
    if (!env.API_BASE_URL) return;
    if (!env.DASHBOARD_DEV_ENGINEER || !env.DASHBOARD_DEV_ORG_UNIT) {
      ctx.addIssue({
        code: 'custom',
        message:
          'API_BASE_URL is set, so DASHBOARD_DEV_ENGINEER and DASHBOARD_DEV_ORG_UNIT are required until OIDC sign-in exists.',
      });
    }
    if (env.NODE_ENV === 'production' && !env.DASHBOARD_ALLOW_DEV_IDENTITY) {
      ctx.addIssue({
        code: 'custom',
        message:
          'The dev identity is refused in production. Set DASHBOARD_ALLOW_DEV_IDENTITY=true only for the local compose demo.',
      });
    }
  });

export class ConfigError extends Error {
  constructor(detail: string) {
    super(`Invalid dashboard config. ${detail} See apps/dashboard/.env.example.`);
    this.name = 'ConfigError';
  }
}

export type ServerConfig =
  | { mode: typeof ServerMode.Mock }
  | {
      mode: typeof ServerMode.Api;
      apiBaseUrl: string;
      devEngineer: string;
      devOrgUnit: string;
      devRoles: string | undefined;
      apiTimeoutMs: number;
    };

export function loadServerConfig(source: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((issue) => issue.message).join(' '));
  }
  const env = parsed.data;
  if (!env.API_BASE_URL || !env.DASHBOARD_DEV_ENGINEER || !env.DASHBOARD_DEV_ORG_UNIT) {
    return { mode: ServerMode.Mock };
  }
  return {
    mode: ServerMode.Api,
    apiBaseUrl: env.API_BASE_URL.replace(/\/$/, ''),
    devEngineer: env.DASHBOARD_DEV_ENGINEER,
    devOrgUnit: env.DASHBOARD_DEV_ORG_UNIT,
    devRoles: env.DASHBOARD_DEV_ROLES,
    apiTimeoutMs: env.API_TIMEOUT_MS,
  };
}

/**
 * `next dev` needs a looser CSP than `next start` (React's dev tooling uses
 * eval). Separate from loadServerConfig so a bad API setting never drops the CSP.
 */
export function isDevelopment(source: NodeJS.ProcessEnv = process.env): boolean {
  return source.NODE_ENV === 'development';
}
