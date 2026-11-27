import type pg from 'pg';
import { describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

const pool = (ok: boolean) =>
  ({
    query: () => (ok ? Promise.resolve({ rows: [] }) : Promise.reject(new Error('down'))),
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
