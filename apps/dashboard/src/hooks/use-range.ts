'use client';

import { useState } from 'react';

import { type DayRange, lastDays } from '@/lib/range';

/**
 * The range every view queries. Held in state so the query key is stable for
 * the life of the page. TODO(X-3): a Dew DateRangePicker in the page header,
 * kept in the URL so a link shares the same view.
 */
export function useRange(): DayRange {
  const [range] = useState(lastDays);
  return range;
}
