import pg from 'pg';

import type { Principal } from './auth/principal.js';

/**
 * One pool per process, connected as the service user (never the table
 * owner, which bypasses row-level security). Queries are parameterised
 * `client.query(text, values)` only. Never build SQL from request input.
 */
export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl, max: 10 });
}

/**
 * Runs `fn` in one transaction with the caller's identity set for row-level
 * security. Every read of per-engineer data goes through this.
 *
 * `set_config(..., true)` is `set local`: it ends with the transaction, so a
 * pooled connection never carries one caller's identity into the next
 * request. The access_log write for an individual view happens inside `fn`,
 * so the read and its audit row commit or roll back together.
 */
export async function withCaller<T>(
  pool: pg.Pool,
  principal: Principal,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("select set_config('app.engineer_id', $1, true)", [principal.engineerId]);
    await client.query("select set_config('app.roles', $1, true)", [principal.roles.join(',')]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
