import type pg from 'pg';

/**
 * Detail is kept 13 months, then its monthly partition is dropped. Summary
 * tables are kept indefinitely (ADR 0006). Departed engineers' detail is
 * purged on the offboarding cycle regardless of age.
 *
 * Dropping a partition is instant and leaves no bloat, which is why raw
 * events are partitioned by month on occurred_at.
 *
 * TODO(BE-1): implement, with a dry-run flag that lists what would be dropped.
 * Resolves to the number of rows purged, which run-job.ts records.
 */
export const DETAIL_RETENTION_MONTHS = 13;

export function applyRetention(_pool: pg.Pool, _now: Date): Promise<number> {
  return Promise.reject(new Error('applyRetention not implemented (BE-1)'));
}
