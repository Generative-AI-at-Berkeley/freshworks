'use client';

import { useQuery } from '@tanstack/react-query';

import { useRange } from '@/hooks/use-range';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

/**
 * Skill adoption for the chosen period and the same length of time before
 * it. Comparisons come from asking the API for the earlier period, never from
 * numbers the dashboard makes up. If that request fails, views drop the
 * comparison and still show the current period.
 */
export function useSkillAdoption() {
  const state = useRange();
  const current = useQuery({
    queryKey: queryKeys.skillAdoption(state.range),
    queryFn: () => apiClient.skillAdoption(state.range),
  });
  const previous = useQuery({
    queryKey: queryKeys.skillAdoption(state.previous),
    queryFn: () => apiClient.skillAdoption(state.previous),
  });
  return { ...state, current, previous: previous.data };
}
