import { describe, expect, it } from 'vitest';

import { createPool } from './db.js';

describe('createPool', () => {
  it('bounds connecting, idling, statements and idle transactions', async () => {
    const pool = createPool('postgres://u:p@localhost:1/db', {
      connectionTimeoutMs: 1000,
      idleTimeoutMs: 2000,
      statementTimeoutMs: 3000,
      idleInTransactionTimeoutMs: 4000,
    });
    expect(pool.options).toMatchObject({
      connectionTimeoutMillis: 1000,
      idleTimeoutMillis: 2000,
      statement_timeout: 3000,
      idle_in_transaction_session_timeout: 4000,
    });
    await pool.end();
  });

  it('has timeouts even when the caller passes none', async () => {
    const pool = createPool('postgres://u:p@localhost:1/db');
    expect(pool.options).toMatchObject({
      statement_timeout: 15_000,
      connectionTimeoutMillis: 5000,
    });
    await pool.end();
  });
});
