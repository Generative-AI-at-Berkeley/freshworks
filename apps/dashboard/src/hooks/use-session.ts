'use client';

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function useSession() {
  return useQuery({ queryKey: queryKeys.session, queryFn: apiClient.session, staleTime: Infinity });
}
