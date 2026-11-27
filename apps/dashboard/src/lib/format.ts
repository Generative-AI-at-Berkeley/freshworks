/**
 * Display formatting. Unknown is `null` in the API and must never render as
 * 0, because zero means measured as zero (docs/api.md, Conventions).
 */

export const NOT_MEASURED = 'Not measured';
export const NOT_PRICED = 'Not priced';

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 });

export function formatCount(value: number | null): string {
  return value === null ? NOT_MEASURED : integer.format(value);
}

export function formatCompact(value: number | null): string {
  return value === null ? NOT_MEASURED : compact.format(value);
}

export function formatPercent(share: number | null): string {
  return share === null ? NOT_MEASURED : percent.format(share);
}

export function formatUsd(value: number | null): string {
  return value === null ? NOT_PRICED : usd.format(value);
}

/** "82% of usage priced". Shown next to every cost so a partial total is never read as the whole. */
export function formatCoverage(coverage: number, what: string): string {
  return `${percent.format(coverage)} of ${what}`;
}

/** Share of installers who used it. Null when nobody has it installed: 0 of 0 is not 0%. */
export function adoptionShare(active: number, installed: number): number | null {
  return installed === 0 ? null : active / installed;
}

const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const fullDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "Oct 30 to Nov 26, 2026". `to` is exclusive in the API, so the last day shown is the one before it. */
export function formatRange(range: { from: string; to: string }): string {
  const from = new Date(`${range.from}T00:00:00Z`);
  const last = new Date(`${range.to}T00:00:00Z`);
  last.setUTCDate(last.getUTCDate() - 1);
  return `${shortDate.format(from)} to ${fullDate.format(last)}`;
}

/** "+12 pts" or "-5 pts" for a change in a share. Null when either side is unknown. */
export function formatPointsDelta(current: number | null, previous: number | null): string | null {
  if (current === null || previous === null) return null;
  const points = Math.round((current - previous) * 100);
  if (points === 0) return 'No change';
  return `${points > 0 ? '+' : '−'}${Math.abs(points)} pts`;
}

/** "+3" or "-2" for a change in a count. */
export function formatCountDelta(current: number, previous: number): string {
  const delta = current - previous;
  if (delta === 0) return 'No change';
  return `${delta > 0 ? '+' : '−'}${integer.format(Math.abs(delta))}`;
}

/** "Nov 26" for one day. */
export function formatDay(day: string): string {
  return shortDate.format(new Date(`${day}T00:00:00Z`));
}

const dateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC',
});

/** An instant as "Nov 26, 14:05 UTC". UTC so every viewer reads the same time. */
export function formatDateTime(iso: string): string {
  return `${dateTime.format(new Date(iso))} UTC`;
}
