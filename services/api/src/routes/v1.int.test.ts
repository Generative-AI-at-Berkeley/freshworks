import { api } from '@fwcoach/contracts';
import { parseAny, parseProblem } from '@fwcoach/testkit';
import type { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';
import { createPool } from '../db.js';

// CI's db job runs these against a freshly migrated database, as the service user.
const url = process.env.APP_DATABASE_URL;

/**
 * Every /v1 route and the schema in packages/contracts its 2xx body must
 * parse with. `null` means no schema exists yet: the owning ticket adds one
 * to packages/contracts/src/api before the route returns data.
 */
const contracts: { route: string; path: string; schema: z.ZodType | null; ticket: string }[] = [
  { route: '/v1/me/data', path: '/v1/me/data', schema: api.MyData, ticket: 'BE-2' },
  {
    route: '/v1/org/:orgUnitId/overview',
    path: '/v1/org/ou-contract/overview',
    schema: api.OrgOverview,
    ticket: 'BE-3',
  },
  {
    route: '/v1/leaders/:managerId/rollup',
    path: '/v1/leaders/e-contract/rollup?depth=1',
    schema: api.LeaderRollup,
    ticket: 'BE-3',
  },
  {
    route: '/v1/engineers/:engineerId',
    path: '/v1/engineers/e-contract',
    schema: api.EngineerDetail,
    ticket: 'BE-2',
  },
  {
    route: '/v1/admin/access-log',
    path: '/v1/admin/access-log',
    schema: api.AccessLog,
    ticket: 'BE-2',
  },
  {
    route: '/v1/skills/adoption',
    path: '/v1/skills/adoption',
    schema: api.SkillAdoption,
    ticket: 'BE-3',
  },
  { route: '/v1/fleet/health', path: '/v1/fleet/health', schema: api.FleetHealth, ticket: 'BE-4' },
];

// Admin, so a route that has landed answers with data where it can.
const admin = { 'x-dev-engineer': 'e-contract', 'x-dev-roles': 'platform_admin' };

describe.runIf(url)('query API contract', () => {
  const pool = createPool(url ?? '');
  const app = buildApp({ pool, authMode: 'local', logger: false });
  const registered: string[] = [];
  app.addHook('onRoute', (route) => {
    if (route.url.startsWith('/v1/') && route.method === 'GET') registered.push(route.url);
  });

  beforeAll(() => app.ready());
  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('has a contract entry for every registered /v1 route', () => {
    expect(registered.sort()).toEqual(contracts.map((c) => c.route).sort());
  });

  it('answers /healthz and /readyz against real Postgres', async () => {
    // No schema for these in packages/contracts. They are not part of the dashboard contract.
    expect((await app.inject('/healthz')).json()).toEqual({ status: 'ok' });
    expect((await app.inject('/readyz')).json()).toEqual({ status: 'ok' });
  });

  describe.each(contracts)('$route', ({ path, schema, ticket }) => {
    it('answers an anonymous caller with a 401 problem', async () => {
      const res = await app.inject(path);
      expect(res.statusCode).toBe(401);
      parseProblem(res);
    });

    it('returns its contract or a problem', async () => {
      const res = await app.inject({ url: path, headers: admin });
      if (res.statusCode === 501) {
        expect(parseProblem(res).detail).toContain(ticket);
        return;
      }
      if (schema === null && res.statusCode < 300) {
        throw new Error(
          `${path} returns data but has no schema. Add one in packages/contracts/src/api.`,
        );
      }
      parseAny(schema ?? api.Problem, res, path);
    });
  });

  // The live checks above pass on a 501. These need seeded rows, and each
  // owner fills theirs in when the route lands.
  it.todo('BE-2: /v1/me/data returns the caller and the raw rows behind their numbers');
  it.todo('BE-2: /v1/engineers/{id} parses as api.EngineerDetail for a seeded engineer');
  it.todo('BE-2: /v1/admin/access-log lists the view the previous test made, for an admin');
  it.todo('BE-3: /v1/org/{id}/overview parses as api.OrgOverview for a seeded org unit');
  it.todo('BE-3: /v1/leaders/{id}/rollup parses as api.LeaderRollup at depth 1 and 2');
  it.todo('BE-3: /v1/skills/adoption parses as api.SkillAdoption, skills sorted by name');
  it.todo('BE-4: every cost total parses as api.Cost, with and without ?explain=true');
});
