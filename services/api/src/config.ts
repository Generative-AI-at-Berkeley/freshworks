import { z } from 'zod';

export const AuthMode = { Local: 'local', Oidc: 'oidc' } as const;
export type AuthMode = (typeof AuthMode)[keyof typeof AuthMode];

const LOCAL_AUTH_ENVS = new Set(['development', 'test']);

const millis = z.coerce.number().int().nonnegative();

/** HTTP server limits. Defaults suit one instance behind the dashboard proxy. */
export const HttpLimits = z.object({
  /** The API is read only, so a large body is never legitimate. */
  bodyLimitBytes: z.coerce
    .number()
    .int()
    .positive()
    .default(64 * 1024),
  /** Time to receive a whole request. Slower clients get 408. */
  requestTimeoutMs: millis.default(30_000),
  /** Idle socket timeout. */
  connectionTimeoutMs: millis.default(60_000),
  /** Longer than a load balancer's idle timeout, so the balancer closes first. */
  keepAliveTimeoutMs: millis.default(72_000),
  /**
   * Requests per caller per window. Counted in memory, so each instance keeps
   * its own count. Move to a shared store before running more than one.
   */
  rateLimitMax: z.coerce.number().int().positive().default(600),
  rateLimitWindowMs: z.coerce.number().int().positive().default(60_000),
  /** Send Strict-Transport-Security. Only when TLS terminates in front of the API. */
  hsts: z.stringbool().default(false),
});
export type HttpLimits = z.infer<typeof HttpLimits>;

/** Postgres timeouts, so a slow query or a leaked transaction cannot pin the pool. */
export const DbTimeouts = z.object({
  connectionTimeoutMs: millis.default(5_000),
  idleTimeoutMs: millis.default(30_000),
  statementTimeoutMs: millis.default(15_000),
  idleInTransactionTimeoutMs: millis.default(15_000),
});
export type DbTimeouts = z.infer<typeof DbTimeouts>;

export const ApiConfig = z
  .object({
    databaseUrl: z.string().startsWith('postgres'),
    port: z.coerce.number().int().default(8080),
    authMode: z.enum([AuthMode.Local, AuthMode.Oidc]).default(AuthMode.Local),
    // Unset means production, so a deployment that forgets NODE_ENV fails
    // closed instead of trusting identity headers.
    nodeEnv: z.string().default('production'),
    /** Opt-in for header auth outside development and test, for the compose demo. Never honoured in production. */
    allowHeaderAuth: z.stringbool().default(false),
    /**
     * /metrics has its own listener. Localhost by default so it is never on
     * the public port or interface. Compose sets 0.0.0.0 and does not publish
     * the port, so only Prometheus on the compose network can scrape it.
     */
    metricsHost: z.string().min(1).default('127.0.0.1'),
    metricsPort: z.coerce.number().int().default(9464),
    /** node_exporter textfile directory for job metrics. Unset writes none. */
    jobMetricsDir: z.string().min(1).optional(),
    http: HttpLimits,
    db: DbTimeouts,
    /** How long shutdown may take before the process exits anyway. */
    shutdownTimeoutMs: z.coerce.number().int().positive().default(10_000),
  })
  // `local` trusts a request header for identity. It exists so the dashboard
  // and e2e tests can run without an identity provider. It is allowed only
  // where nothing real can be reached: development, test, or an explicit
  // opt-in outside production. An unknown or misspelled NODE_ENV does not
  // count as safe.
  .superRefine((c, ctx) => {
    if (c.authMode !== AuthMode.Local) return;
    if (c.nodeEnv === 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['authMode'],
        message:
          'API_AUTH_MODE=local is refused when NODE_ENV=production (the default), even with API_ALLOW_HEADER_AUTH=true. Set API_AUTH_MODE=oidc, or NODE_ENV=development for local work.',
      });
    } else if (!LOCAL_AUTH_ENVS.has(c.nodeEnv) && !c.allowHeaderAuth) {
      ctx.addIssue({
        code: 'custom',
        path: ['authMode'],
        message: `API_AUTH_MODE=local needs NODE_ENV=development or test, got "${c.nodeEnv}". For the local compose demo only, set API_ALLOW_HEADER_AUTH=true.`,
      });
    }
  });
export type ApiConfig = z.infer<typeof ApiConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = ApiConfig.safeParse({
    // APP_DATABASE_URL in .env, so the API never picks up dbmate's owner URL by accident.
    databaseUrl: env['APP_DATABASE_URL'],
    port: env['API_PORT'],
    authMode: env['API_AUTH_MODE'],
    nodeEnv: env['NODE_ENV'],
    allowHeaderAuth: env['API_ALLOW_HEADER_AUTH'],
    metricsHost: env['API_METRICS_HOST'],
    metricsPort: env['API_METRICS_PORT'],
    jobMetricsDir: env['JOB_METRICS_DIR'],
    http: {
      bodyLimitBytes: env['API_BODY_LIMIT_BYTES'],
      requestTimeoutMs: env['API_REQUEST_TIMEOUT_MS'],
      connectionTimeoutMs: env['API_CONNECTION_TIMEOUT_MS'],
      keepAliveTimeoutMs: env['API_KEEP_ALIVE_TIMEOUT_MS'],
      rateLimitMax: env['API_RATE_LIMIT_MAX'],
      rateLimitWindowMs: env['API_RATE_LIMIT_WINDOW_MS'],
      hsts: env['API_HSTS'],
    },
    db: {
      connectionTimeoutMs: env['API_DB_CONNECTION_TIMEOUT_MS'],
      idleTimeoutMs: env['API_DB_IDLE_TIMEOUT_MS'],
      statementTimeoutMs: env['API_DB_STATEMENT_TIMEOUT_MS'],
      idleInTransactionTimeoutMs: env['API_DB_IDLE_IN_TRANSACTION_TIMEOUT_MS'],
    },
    shutdownTimeoutMs: env['API_SHUTDOWN_TIMEOUT_MS'],
  });
  if (!parsed.success) throw new Error(`Invalid API config.\n${z.prettifyError(parsed.error)}`);
  return parsed.data;
}
