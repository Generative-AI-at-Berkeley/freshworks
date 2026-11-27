import type pg from 'pg';

/**
 * Rebuilds request_rollup_daily and skill_usage_fact for one UTC day.
 *
 * Idempotent by design: it replaces the day's rows inside one transaction, so
 * re-running a day after late events arrive, or after a price change, gives
 * the same answer as running it once.
 *
 * Subagent work is counted inside its parent session and also broken out in
 * its own columns (ADR 0003).
 *
 * TODO(BE-3): implement, along with migrations for the tables it fills.
 */
export function rollupDay(_pool: pg.Pool, day: string): Promise<void> {
  return Promise.reject(new Error(`rollupDay(${day}) not implemented (BE-3)`));
}
