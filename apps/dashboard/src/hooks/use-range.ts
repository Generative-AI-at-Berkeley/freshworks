'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { type DayRange, lastDays, parsePreset, previousRange, type RangePreset } from '@/lib/range';

export interface RangeState {
  days: RangePreset;
  range: DayRange;
  /** The same length of time just before `range`. */
  previous: DayRange;
  setDays: (days: RangePreset) => void;
}

/**
 * The period every view queries, kept in the URL (`?days=28`) so a link opens
 * the same view and the back button undoes a change.
 */
export function useRange(): RangeState {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const days = parsePreset(params.get('days'));
  const range = useMemo(() => lastDays(days), [days]);
  const previous = useMemo(() => previousRange(range), [range]);
  const setDays = (next: RangePreset) => {
    const search = new URLSearchParams(params.toString());
    search.set('days', String(next));
    router.replace(`${pathname}?${search.toString()}`, { scroll: false });
  };
  return { days, range, previous, setDays };
}

/** Carries the current `?days=` onto a link, so drilling down keeps the period. */
export function useWithRange(): (href: string) => string {
  const params = useSearchParams();
  const days = params.get('days');
  return (href) => (days ? `${href}?days=${encodeURIComponent(days)}` : href);
}
