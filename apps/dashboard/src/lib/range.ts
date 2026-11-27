import { DEFAULT_RANGE_DAYS } from '@/config/constants';

export interface DayRange {
  from: string;
  to: string;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The last N whole UTC days, `to` exclusive (docs/api.md). Today is left out
 * because its rollup has not run yet.
 */
export function lastDays(days: number = DEFAULT_RANGE_DAYS, now: Date = new Date()): DayRange {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days);
  return { from: isoDay(from), to: isoDay(to) };
}
