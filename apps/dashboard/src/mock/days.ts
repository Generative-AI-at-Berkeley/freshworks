import type { DayRange } from '@/lib/range';
import { eachDay } from '@/lib/range';

/** The last day of a range, as the mock's "data through" date. */
export function lastDay(range: DayRange): string | null {
  return eachDay(range).at(-1) ?? null;
}
