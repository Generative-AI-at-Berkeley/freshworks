import {
  QueryClient,
  defaultShouldDehydrateQuery,
  environmentManager,
} from '@tanstack/react-query';

import { ApiError } from '@/lib/api-client';

/**
 * How long fetched data is considered fresh. Rollups change once a night, so a
 * minute of staleness costs nothing and avoids refetching
 * on every tab focus.
 */
const STALE_TIME_MS = 60 * 1000;

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        // A 4xx will say the same thing the second time. Retry only network and 5xx failures.
        retry: (failureCount, error) =>
          failureCount < 1 &&
          !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
      dehydrate: {
        // Include still-pending queries when serializing server state, so a
        // query started during server render can finish on the client rather
        // than being thrown away and refetched.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * One QueryClient per server request, one shared instance in the browser.
 *
 * On the server a shared client would leak one user's data into another user's
 * request. In the browser a new client on every render would throw away the
 * cache, so it has to be created once and reused.
 */
export function getQueryClient(): QueryClient {
  if (environmentManager.isServer()) {
    return makeQueryClient();
  }
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
