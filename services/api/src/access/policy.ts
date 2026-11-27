import type pg from 'pg';

import type { Principal } from '../auth/principal.js';

/**
 * Who may see an individual's data (spec 7.5, 8). Enforced twice: here, and
 * in Postgres row-level security, so a missed check in a route still cannot
 * leak rows.
 *
 *   - the engineer themselves
 *   - anyone above them in the management chain as of `asOf`, read from
 *     manager_edge (effective-dated, so a reorg does not rewrite history)
 *   - platform administrators
 *
 * Never lateral, never org-wide. Both methods take the client from
 * `withCaller` (db.ts), so the check, the read and the access_log row all
 * happen in one transaction.
 *
 * TODO(BE-2): implement with a recursive CTE over manager_edge.
 */
export interface AccessPolicy {
  canViewEngineer(
    client: pg.PoolClient,
    principal: Principal,
    engineerId: string,
    asOf: Date,
  ): Promise<boolean>;
  recordView(
    client: pg.PoolClient,
    principal: Principal,
    engineerId: string,
    route: string,
  ): Promise<void>;
}
