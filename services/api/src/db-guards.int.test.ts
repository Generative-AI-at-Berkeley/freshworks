import { randomBytes } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Database-side rails other tickets build on: app.append_only() for audit
 * tables, and the role-level timeouts on the service user.
 */

// Owner to create the scratch table (services cannot), service user for the rest.
const ownerUrl = process.env.DATABASE_URL;
const appUrl = process.env.APP_DATABASE_URL;

async function failure(query: Promise<unknown>): Promise<{ code?: string; message: string }> {
  try {
    await query;
  } catch (error) {
    return error as { code?: string; message: string };
  }
  throw new Error('Expected the query to fail. It succeeded, so the guard is missing.');
}

describe.runIf(ownerUrl && appUrl)('app.append_only', () => {
  const owner = new pg.Client({ connectionString: ownerUrl });
  const app = new pg.Client({ connectionString: appUrl });
  // Unique per run, so a crashed run never collides with the next one.
  const table = `app.append_only_scratch_${randomBytes(4).toString('hex')}`;

  beforeAll(async () => {
    await owner.connect();
    await app.connect();
    await owner.query(`create table ${table} (id int primary key, note text not null)`);
    await owner.query('select app.append_only($1::regclass)', [table]);
  });

  afterAll(async () => {
    await owner.query(`drop table if exists ${table}`);
    await app.end();
    await owner.end();
  });

  it('lets the service insert and read', async () => {
    await app.query(`insert into ${table} (id, note) values ($1, $2)`, [1, 'first']);
    const { rows } = await app.query<{ note: string }>(
      `select note from ${table} where id = $1`,
      [1],
    );
    expect(rows).toEqual([{ note: 'first' }]);
  });

  it.each([
    ['update', `update ${table} set note = 'changed'`],
    ['delete', `delete from ${table}`],
    ['truncate', `truncate ${table}`],
  ])('refuses %s from the service', async (_name, sql) => {
    const error = await failure(app.query(sql));
    expect(error.code).toBe('42501');
    expect(error.message).toContain('permission denied');
  });

  it.each([
    ['update', `update ${table} set note = 'changed'`],
    ['delete', `delete from ${table}`],
    ['truncate', `truncate ${table}`],
  ])('refuses %s from the owner too, via the trigger', async (_name, sql) => {
    const error = await failure(owner.query(sql));
    expect(error.code).toBe('42501');
    expect(error.message).toContain('is append-only');
  });

  it('kept the row through every refused change', async () => {
    const { rows } = await owner.query<{ note: string }>(`select note from ${table}`);
    expect(rows).toEqual([{ note: 'first' }]);
  });

  it('cannot be called by the service', async () => {
    await expect(app.query('select app.append_only($1::regclass)', [table])).rejects.toMatchObject({
      code: '42501',
    });
  });
});

describe.runIf(appUrl)('service role timeouts', () => {
  const app = new pg.Client({ connectionString: appUrl });
  beforeAll(() => app.connect());
  afterAll(() => app.end());

  it('sets the backstop timeouts on the login role the services use', async () => {
    // rolconfig, not `show`, so a pool-level override cannot mask a missing role setting.
    const { rows } = await app.query<{ rolconfig: string[] | null }>(
      'select rolconfig from pg_roles where rolname = current_user',
    );
    expect(rows[0]?.rolconfig).toEqual(
      expect.arrayContaining([
        'statement_timeout=30s',
        'lock_timeout=5s',
        'idle_in_transaction_session_timeout=60s',
      ]),
    );
  });
});
