import { describe, expect, it } from 'vitest';

import { adoptionShare, formatCount, formatUsd, NOT_MEASURED, NOT_PRICED } from '@/lib/format';

describe('format', () => {
  it('shows unknown as unknown, never as zero', () => {
    expect(formatCount(null)).toBe(NOT_MEASURED);
    expect(formatUsd(null)).toBe(NOT_PRICED);
    expect(formatCount(0)).toBe('0');
  });

  it('has no adoption share for a skill nobody installed', () => {
    expect(adoptionShare(0, 0)).toBeNull();
    expect(adoptionShare(0, 8)).toBe(0);
  });
});
