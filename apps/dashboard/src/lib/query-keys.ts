import type { DayRange } from '@/lib/range';

/** One place for cache keys, so an invalidation cannot miss a spelling. */
export const queryKeys = {
  session: ['session'] as const,
  skillAdoption: (range: DayRange) => ['skills', 'adoption', range] as const,
  orgOverview: (orgUnitId: string, range: DayRange) => ['org', orgUnitId, range] as const,
  leaderRollup: (managerId: string, depth: number, range: DayRange) =>
    ['leaders', managerId, depth, range] as const,
  engineer: (engineerId: string, range: DayRange) => ['engineers', engineerId, range] as const,
};
