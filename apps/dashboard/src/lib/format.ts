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
