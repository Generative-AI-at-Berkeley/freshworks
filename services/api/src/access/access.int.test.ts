import { seedOrg, unseedOrg, type OrgRows, type SyntheticPerson } from '@fwcoach/testkit';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Role, type Principal } from '../auth/principal.js';
import { createPool, withCaller } from '../db.js';

/**
 * The access rule from docs/data-model.md, as a table of cases. Seeds a
 * fixed synthetic org as the owner, then asks as each viewer through
 * `withCaller`, which sets app.engineer_id for one transaction.
 *
 * BE-2 ships `app.reports_to(viewer, subject, as_of)` and the identity
 * tables. Until they exist the cases are skipped. They switch on by
 * themselves once the migration lands, so BE-2 sees at once whether the
 * function agrees with this table.
 */

// Owner for seeding (dbmate's URL), service user for every caller-scoped query.
const ownerUrl = process.env['DATABASE_URL'];
const appUrl = process.env['APP_DATABASE_URL'];

const REORG = new Date('2026-06-01');
const BEFORE = '2026-03-01';
const AFTER = '2026-09-01';

const at = (
  employeeId: string,
  managerId: string | null,
  departmentId: string,
  effectiveFrom = new Date('2026-01-01'),
): SyntheticPerson => ({
  employeeId,
  ssoSubject: null,
  workEmail: `${employeeId}@example.com`,
  displayName: `Test ${employeeId}`,
  departmentId,
  managerId,
  effectiveFrom,
});

/**
 * acx-top leads acx-ma and acx-mb. acx-a1 and acx-a2 report to acx-ma, until
 * the reorg moves acx-a2 to acx-mb. acx-admin reports to nobody and is a
 * platform admin. Hand-built rather than generateOrg (BE-2), so each case
 * names a fixed relationship. Same DirectoryRecord shape, same seeding path.
 */
const ORG: SyntheticPerson[] = [
  at('acx-top', null, 'acx-dept-eng'),
  at('acx-ma', 'acx-top', 'acx-dept-a'),
  at('acx-mb', 'acx-top', 'acx-dept-b'),
  at('acx-a1', 'acx-ma', 'acx-dept-a'),
  at('acx-a2', 'acx-ma', 'acx-dept-a'),
  at('acx-a2', 'acx-mb', 'acx-dept-b', REORG),
  at('acx-b1', 'acx-mb', 'acx-dept-b'),
  at('acx-admin', null, 'acx-dept-eng'),
];

interface Case {
  name: string;
  viewer: string;
  subject: string;
  asOf: string;
  /** Whether the subject is in the viewer's subtree on that date. */
  reportsTo: boolean;
}

const SUBTREE_CASES: Case[] = [
  { name: 'direct report', viewer: 'acx-ma', subject: 'acx-a1', asOf: AFTER, reportsTo: true },
  { name: 'skip-level report', viewer: 'acx-top', subject: 'acx-a1', asOf: AFTER, reportsTo: true },
  { name: 'peer', viewer: 'acx-a1', subject: 'acx-a2', asOf: BEFORE, reportsTo: false },
  { name: 'report looking up', viewer: 'acx-a1', subject: 'acx-ma', asOf: AFTER, reportsTo: false },
  {
    name: 'manager of another subtree',
    viewer: 'acx-mb',
    subject: 'acx-a1',
    asOf: AFTER,
    reportsTo: false,
  },
  {
    name: 'departed manager, before the reorg',
    viewer: 'acx-ma',
    subject: 'acx-a2',
    asOf: BEFORE,
    reportsTo: true,
  },
  {
    name: 'departed manager, after the reorg',
    viewer: 'acx-ma',
    subject: 'acx-a2',
    asOf: AFTER,
    reportsTo: false,
  },
  {
    name: 'new manager, before the reorg',
    viewer: 'acx-mb',
    subject: 'acx-a2',
    asOf: BEFORE,
    reportsTo: false,
  },
  {
    name: 'new manager, after the reorg',
    viewer: 'acx-mb',
    subject: 'acx-a2',
    asOf: AFTER,
    reportsTo: true,
  },
  {
    name: 'skip-level across the reorg',
    viewer: 'acx-top',
    subject: 'acx-a2',
    asOf: AFTER,
    reportsTo: true,
  },
];

async function hasBe2Schema(url: string): Promise<boolean> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ ready: boolean }>(
      `select to_regclass('app.engineer') is not null
          and to_regclass('app.manager_edge') is not null
          and to_regclass('app.org_unit') is not null
          and exists (
            select from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'reports_to'
          ) as ready`,
    );
    return rows[0]?.ready ?? false;
  } finally {
    await client.end();
  }
}

const ready = ownerUrl && appUrl ? await hasBe2Schema(appUrl) : false;

const principal = (engineerId: string): Principal => ({ engineerId, roles: [Role.Engineer] });

describe('access control', () => {
  describe.runIf(ready)('app.reports_to as each caller (BE-2)', () => {
    const owner = new pg.Client({ connectionString: ownerUrl });
    const pool = createPool(appUrl ?? '');
    let rows: OrgRows;

    beforeAll(async () => {
      await owner.connect();
      rows = await seedOrg(owner, ORG);
    });
    afterAll(async () => {
      await unseedOrg(owner, rows);
      await owner.end();
      await pool.end();
    });

    it.each(SUBTREE_CASES)('$name', async ({ viewer, subject, asOf, reportsTo }) => {
      const answer = await withCaller(pool, principal(viewer), async (client) => {
        const { rows } = await client.query<{ ok: boolean }>(
          "select app.reports_to(current_setting('app.engineer_id'), $1, $2::date) as ok",
          [subject, asOf],
        );
        return rows[0]?.ok;
      });
      expect(answer).toBe(reportsTo);
    });
  });

  // Self and platform admin are not subtree questions: docs/data-model.md puts
  // them in the RLS policy next to reports_to. They need a protected table.
  it.todo('BE-2: self, an engineer sees their own rows in a table under app.protect()');
  it.todo('BE-2: platform admin (app.roles) sees every engineer under app.protect()');
  it.todo('BE-2: every SUBTREE_CASES row holds for RLS on a table under app.protect()');
  it.todo('BE-2: RLS uses the row date, so the departed manager keeps pre-reorg rows only');
  it.todo('BE-2: AccessPolicy.canViewEngineer agrees with app.reports_to on every case');
  it.todo('BE-2: AccessPolicy.recordView writes access_log in the same transaction');
  it.todo('BE-2: a caller-scoped query with no app.engineer_id set sees no rows');
  it.todo('BE-2: manager role is derived from manager_edge, never from X-Dev-Roles');
});
