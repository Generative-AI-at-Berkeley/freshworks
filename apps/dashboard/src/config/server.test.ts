import { describe, expect, it } from 'vitest';

import { ServerMode } from '@/config/enums';
import { ConfigError, loadServerConfig } from '@/config/server';

const api = {
  API_BASE_URL: 'http://127.0.0.1:8080/',
  DASHBOARD_DEV_ENGINEER: 'e-100',
  DASHBOARD_DEV_ORG_UNIT: 'org-eng',
};

describe('loadServerConfig', () => {
  it('runs on mock data when no API is configured', () => {
    expect(loadServerConfig({ NODE_ENV: 'development', API_BASE_URL: '' })).toEqual({
      mode: ServerMode.Mock,
    });
  });

  it('uses the API with the dev identity, without a trailing slash', () => {
    expect(loadServerConfig({ NODE_ENV: 'development', ...api })).toMatchObject({
      mode: ServerMode.Api,
      apiBaseUrl: 'http://127.0.0.1:8080',
      devEngineer: 'e-100',
    });
  });

  it('refuses an API without an identity to send', () => {
    expect(() =>
      loadServerConfig({ NODE_ENV: 'development', API_BASE_URL: api.API_BASE_URL }),
    ).toThrow(ConfigError);
  });

  it('refuses the dev identity in production unless explicitly allowed', () => {
    expect(() => loadServerConfig({ NODE_ENV: 'production', ...api })).toThrow(
      /refused in production/,
    );
    expect(
      loadServerConfig({ NODE_ENV: 'production', DASHBOARD_ALLOW_DEV_IDENTITY: 'true', ...api })
        .mode,
    ).toBe(ServerMode.Api);
  });
});
