import { DEFAULT_RANGE_DAYS } from '@/config/constants';

export interface DayRange {
  from: string;
  to: string;
}

/** The periods the range control offers. Every one is a plain from/to the API already accepts. */
export const RANGE_PRESETS = [7, 28, 90] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

const DAY_MS = 86_400_000;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** Reads `?days=` from the URL. Anything that is not a preset falls back to the default. */
export function parsePreset(value: string | null): RangePreset {
  const days = Number(value);
  return (RANGE_PRESETS as readonly number[]).includes(days)
    ? (days as RangePreset)
    : DEFAULT_RANGE_DAYS;
}

/**
 * The last N whole UTC days, `to` exclusive (docs/api.md). Today is left out
 * because its rollup has not run yet.
 */
export function lastDays(days: number = DEFAULT_RANGE_DAYS, now: Date = new Date()): DayRange {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { from: isoDay(new Date(to.getTime() - days * DAY_MS)), to: isoDay(to) };
}

/** The same number of days immediately before `range`, for period-over-period comparison. */
export function previousRange(range: DayRange): DayRange {
  const days = daysIn(range);
  return { from: isoDay(new Date(parseDay(range.from).getTime() - days * DAY_MS)), to: range.from };
}

/** Whole days in a range, `to` exclusive. */
export function daysIn(range: DayRange): number {
  return Math.round((parseDay(range.to).getTime() - parseDay(range.from).getTime()) / DAY_MS);
}

/** Every day in a range, oldest first. */
export function eachDay(range: DayRange): string[] {
  const out: string[] = [];
  for (let t = parseDay(range.from).getTime(); t < parseDay(range.to).getTime(); t += DAY_MS) {
    out.push(isoDay(new Date(t)));
  }
  return out;
}

/**
 * Trailing mean over `window` points. Early points average what exists so
 * far. Used to read a trend through weekday and weekend swings.
 */
export function rollingMean(values: readonly number[], window = 7): number[] {
  return values.map((_, index) => {
    const slice = values.slice(Math.max(0, index - window + 1), index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });
}
