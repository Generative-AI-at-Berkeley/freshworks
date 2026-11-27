import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';

const db = 'postgres://u:p@localhost:5432/db';
const base = { APP_DATABASE_URL: db };

describe('loadConfig', () => {
  it('defaults to local auth in development', () => {
    expect(loadConfig({ ...base, NODE_ENV: 'development' }).authMode).toBe('local');
  });

  it('treats an unset NODE_ENV as production and refuses local auth', () => {
    expect(() => loadConfig(base)).toThrow(/NODE_ENV=production/);
  });

  it.each(['production', 'staging', 'prod'])('refuses local auth when NODE_ENV=%s', (env) => {
    expect(() => loadConfig({ ...base, NODE_ENV: env })).toThrow(/local/);
  });

  it('allows local auth outside dev only with the explicit opt-in', () => {
    const config = loadConfig({ ...base, NODE_ENV: 'staging', API_ALLOW_HEADER_AUTH: 'true' });
    expect(config.authMode).toBe('local');
  });

  it('never allows local auth in production, opt-in or not', () => {
    expect(() =>
      loadConfig({ ...base, NODE_ENV: 'production', API_ALLOW_HEADER_AUTH: 'true' }),
    ).toThrow(/refused when NODE_ENV=production/);
  });

  it('starts in production with oidc', () => {
    expect(loadConfig({ ...base, API_AUTH_MODE: 'oidc' }).nodeEnv).toBe('production');
  });

  it('reads limits and timeouts, with defaults', () => {
    const config = loadConfig({
      ...base,
      NODE_ENV: 'test',
      API_RATE_LIMIT_MAX: '5',
      API_DB_STATEMENT_TIMEOUT_MS: '2000',
      API_HSTS: 'true',
    });
    expect(config.http).toMatchObject({ rateLimitMax: 5, hsts: true, bodyLimitBytes: 65_536 });
    expect(config.db).toMatchObject({ statementTimeoutMs: 2000, connectionTimeoutMs: 5000 });
  });

  it('rejects a limit that is not a number', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'test', API_RATE_LIMIT_MAX: 'lots' })).toThrow(
      /Invalid API config/,
    );
  });
});
