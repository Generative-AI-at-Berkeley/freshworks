import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';

const db = 'postgres://u:p@localhost:5432/db';
const base = { APP_DATABASE_URL: db };

describe('loadConfig', () => {
  it('defaults to local auth outside production', () => {
    expect(loadConfig(base).authMode).toBe('local');
  });

  it.each(['production', 'staging', 'prod'])('refuses local auth when NODE_ENV=%s', (env) => {
    expect(() => loadConfig({ ...base, NODE_ENV: env })).toThrow(/local/);
  });

  it('allows local auth outside dev only with the explicit opt-in', () => {
    const config = loadConfig({ ...base, NODE_ENV: 'staging', API_ALLOW_HEADER_AUTH: 'true' });
    expect(config.authMode).toBe('local');
  });
});
