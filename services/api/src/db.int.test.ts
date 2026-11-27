import { afterAll, describe, expect, it } from 'vitest';

import { createPool, withCaller } from './db.js';

// CI's db job runs these against a freshly migrated database, as the service user.
const url = process.env['APP_DATABASE_URL'];

describe.runIf(url)('database', () => {
  const pool = createPool(url ?? '');
  afterAll(() => pool.end());

  it('can use the app schema, which only the baseline migration grants', async () => {
    const { rows } = await pool.query<{ ok: boolean }>(
      "select has_schema_privilege('app', 'usage') as ok",
    );
    expect(rows[0]?.ok).toBe(true);
  });

  it('connects as a role that row-level security applies to', async () => {
    const { rows } = await pool.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      'select rolsuper, rolbypassrls from pg_roles where rolname = current_user',
    );
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it('sets the server-side timeouts on every connection', async () => {
    const { rows } = await pool.query<{ statement: string; idle: string }>(
      "select current_setting('statement_timeout') as statement, current_setting('idle_in_transaction_session_timeout') as idle",
    );
    expect(rows[0]).toEqual({ statement: '15s', idle: '15s' });
  });

  it('cancels a statement that runs past the timeout', async () => {
    const short = createPool(url ?? '', {
      connectionTimeoutMs: 5000,
      idleTimeoutMs: 1000,
      statementTimeoutMs: 100,
      idleInTransactionTimeoutMs: 1000,
    });
    try {
      await expect(short.query('select pg_sleep(1)')).rejects.toThrow(/statement timeout/);
    } finally {
      await short.end();
    }
  });

  it('scopes the caller to one transaction', async () => {
    const principal = { engineerId: 'E1', roles: ['engineer' as const] };
    const inside = await withCaller(pool, principal, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        "select current_setting('app.engineer_id') as id",
      );
      return rows[0]?.id;
    });
    expect(inside).toBe('E1');

    const { rows } = await pool.query<{ id: string | null }>(
      "select current_setting('app.engineer_id', true) as id",
    );
    expect(rows[0]?.id ?? '').toBe('');
  });
});
