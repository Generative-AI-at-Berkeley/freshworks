import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const call = (path: string[], init?: RequestInit) =>
  GET(
    new Request(
      `http://dashboard.test/api/v1/${path.join('/')}?from=2026-11-01&to=2026-11-08`,
      init,
    ),
    {
      params: Promise.resolve({ path }),
    },
  );

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('API proxy', () => {
  it('answers from mock data when no API is configured', async () => {
    vi.stubEnv('API_BASE_URL', '');
    const response = await call(['skills', 'adoption']);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      range: { from: '2026-11-01', to: '2026-11-08' },
    });
  });

  it('refuses dot segments instead of building a different API path', async () => {
    const response = await call(['engineers', '..', 'admin']);
    expect(response.status).toBe(400);
  });

  it('sends the configured identity and never the one the browser sent', async () => {
    vi.stubEnv('API_BASE_URL', 'http://api.test');
    vi.stubEnv('DASHBOARD_DEV_ENGINEER', 'e-100');
    vi.stubEnv('DASHBOARD_DEV_ORG_UNIT', 'org-eng');
    const upstream = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve(new Response('{}', { headers: { 'content-type': 'application/json' } })),
    );
    vi.stubGlobal('fetch', upstream);

    await call(['engineers', 'e-111'], {
      headers: { 'x-dev-engineer': 'e-999', 'x-dev-roles': 'platform_admin' },
    });

    const [url, init] = upstream.mock.calls[0] ?? [];
    expect(url).toBe('http://api.test/v1/engineers/e-111?from=2026-11-01&to=2026-11-08');
    const headers = new Headers(init?.headers);
    expect(headers.get('x-dev-engineer')).toBe('e-100');
    expect(headers.get('x-dev-roles')).toBeNull();
  });

  it('mints a request ID per call, ignores the browser one, and returns it', async () => {
    vi.stubEnv('API_BASE_URL', 'http://api.test');
    vi.stubEnv('DASHBOARD_DEV_ENGINEER', 'e-100');
    vi.stubEnv('DASHBOARD_DEV_ORG_UNIT', 'org-eng');
    const upstream = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve(new Response('{}', { headers: { 'content-type': 'application/json' } })),
    );
    vi.stubGlobal('fetch', upstream);

    const browserId = 'browser-chosen-id-0001';
    const first = await call(['skills', 'adoption'], { headers: { 'x-request-id': browserId } });
    const second = await call(['skills', 'adoption']);

    const sent = upstream.mock.calls.map(([, init]) =>
      new Headers(init.headers).get('x-request-id'),
    );
    expect(sent[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent[0]).not.toBe(browserId);
    expect(sent[1]).not.toBe(sent[0]);
    expect(first.headers.get('x-request-id')).toBe(sent[0]);
    expect(second.headers.get('x-request-id')).toBe(sent[1]);
  });

  it('turns an unreachable API into a problem the dashboard can show', async () => {
    vi.stubEnv('API_BASE_URL', 'http://api.test');
    vi.stubEnv('DASHBOARD_DEV_ENGINEER', 'e-100');
    vi.stubEnv('DASHBOARD_DEV_ORG_UNIT', 'org-eng');
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('connect ECONNREFUSED')));
    const response = await call(['skills', 'adoption']);
    expect(response.status).toBe(502);
    const body = (await response.json()) as { detail: string; requestId: string };
    expect(body.detail).toContain('Could not reach the API');
    expect(body.requestId).toBe(response.headers.get('x-request-id'));
  });
});
