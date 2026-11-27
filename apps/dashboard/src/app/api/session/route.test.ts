import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('session route', () => {
  it('answers a bad config with a 503 problem', async () => {
    vi.stubEnv('API_BASE_URL', 'http://api.test');
    vi.stubEnv('DASHBOARD_DEV_ENGINEER', '');
    const response = GET();
    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    expect(await response.json()).toMatchObject({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      detail: expect.stringContaining('Invalid dashboard config') as unknown,
    });
  });
});
