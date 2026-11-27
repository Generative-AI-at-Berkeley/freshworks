import type pg from 'pg';
import { describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import { buildMetricsApp, createMetrics } from './metrics.js';

const pool = (ok: boolean) =>
  ({
    query: () => (ok ? Promise.resolve({ rows: [] }) : Promise.reject(new Error('down'))),
    totalCount: 2,
    idleCount: 1,
    waitingCount: 0,
  }) as unknown as pg.Pool;

describe('api', () => {
  it('is ready only when Postgres answers', async () => {
    expect(
      (await buildApp({ pool: pool(true), authMode: 'local', logger: false }).inject('/readyz'))
        .statusCode,
    ).toBe(200);
    expect(
      (await buildApp({ pool: pool(false), authMode: 'local', logger: false }).inject('/readyz'))
        .statusCode,
    ).toBe(503);
  });

  it('rejects /v1 calls with no caller', async () => {
    const app = buildApp({ pool: pool(true), authMode: 'local', logger: false });
    expect((await app.inject('/v1/me/data')).statusCode).toBe(401);
  });

  it('rejects an encoded path that routes to /v1 with no caller', async () => {
    const app = buildApp({ pool: pool(true), authMode: 'local', logger: false });
    expect((await app.inject('/%761/me/data')).statusCode).toBe(401);
  });

  it('registers every spec route, unimplemented for now', async () => {
    const app = buildApp({ pool: pool(true), authMode: 'local', logger: false });
    const res = await app.inject({ url: '/v1/fleet/health', headers: { 'x-dev-engineer': 'E1' } });
    expect(res.statusCode).toBe(501);
  });
});

describe('api observability', () => {
  const TOKEN = 'SECRET_BEARER_TOKEN_123';
  const BODY = '{"prompt":"synthetic prompt text"}';

  it('keeps tokens, identity headers and bodies out of the logs', async () => {
    const lines: string[] = [];
    const app = buildApp({
      pool: pool(true),
      authMode: 'local',
      logStream: { write: (line) => void lines.push(line) },
    });
    app.post('/echo', (request) => {
      // The mistake the redaction list is a backstop for.
      request.log.info({ headers: request.headers, body: request.body }, 'echo');
      return {};
    });
    await app.inject({
      method: 'POST',
      url: '/echo',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        cookie: `session=${TOKEN}`,
        'x-dev-engineer': 'E-SECRET-1',
        'content-type': 'application/json',
      },
      payload: BODY,
    });
    app.log.info({ authorization: `Bearer ${TOKEN}`, 'x-dev-engineer': 'E-SECRET-1' }, 'direct');

    const output = lines.join('');
    expect(output).toContain('request completed');
    expect(output).toContain('echo');
    expect(output).not.toContain(TOKEN);
    expect(output).not.toContain('E-SECRET-1');
    expect(output).not.toContain('synthetic prompt text');
  });

  it('uses a valid inbound request ID and returns it in the header and the problem body', async () => {
    const app = buildApp({ pool: pool(true), authMode: 'local', logger: false });
    const id = '0b6a3d4e-1111-4222-8333-944455556666';
    const res = await app.inject({ url: '/v1/me/data', headers: { 'x-request-id': id } });
    expect(res.statusCode).toBe(401);
    expect(res.headers['x-request-id']).toBe(id);
    expect(res.json()).toMatchObject({ status: 401, requestId: id });
  });

  it('replaces a malformed request ID instead of logging it', async () => {
    const app = buildApp({ pool: pool(true), authMode: 'local', logger: false });
    const res = await app.inject({ url: '/nope', headers: { 'x-request-id': 'bad id {"x":1}' } });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const id = res.headers['x-request-id'];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.json()).toMatchObject({ requestId: id });
  });

  it('answers an unexpected error with a problem that hides the cause', async () => {
    const app = buildApp({ pool: pool(true), authMode: 'local', logger: false });
    app.get('/boom', () => {
      throw new Error('connection string postgres://u:p@db');
    });
    const res = await app.inject('/boom');
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('postgres://');
    expect(res.json()).toMatchObject({ status: 500, requestId: res.headers['x-request-id'] });
  });

  it('counts requests by route template and reports the pool, on the metrics app only', async () => {
    const metrics = createMetrics(pool(true));
    const app = buildApp({ pool: pool(true), authMode: 'local', logger: false, metrics });
    await app.inject({ url: '/v1/engineers/e-123', headers: { 'x-dev-engineer': 'E1' } });
    await app.inject({ url: '/v1/engineers/e-456', headers: { 'x-dev-engineer': 'E1' } });
    expect((await app.inject('/metrics')).statusCode).toBe(404);

    const res = await buildMetricsApp(metrics.registry).inject('/metrics');
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.body).toContain(
      'http_server_request_duration_seconds_count{method="GET",route="/v1/engineers/:engineerId",status_code="501"} 2',
    );
    expect(res.body).not.toContain('e-123');
    expect(res.body).toContain('fwcoach_pg_pool_total_connections 2');
    expect(res.body).toContain('fwcoach_pg_pool_waiting_clients 0');
  });
});
