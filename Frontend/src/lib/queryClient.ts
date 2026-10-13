import { QueryClient } from '@tanstack/react-query';

/**
 * Global TanStack QueryClient Configuration.
 * 
 * Cache Strategy & Sensible Times Rationale:
 * - staleTime (default: 2 minutes):
 *   Server data is considered fresh for 2 minutes. During this period, navigating
 *   between screens or re-focusing will instantly read from the in-memory cache
 *   without triggering unnecessary network roundtrips.
 * - gcTime / cacheTime (10 minutes):
 *   Inactive cache queries remain in memory for 10 minutes before being garbage collected.
 * - retry: 2 with exponential backoff for queries, ensuring resilience on unstable cellular connections.
 * - mutations: retry: 0 by default so optimistic updates and rollback can provide immediate user feedback.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes default freshness
      gcTime: 10 * 60 * 1000,    // 10 minutes cache retention
      retry: (failureCount, error: any) => {
        // Do not retry 4xx client errors (401, 403, 404, 400)
        if (error?.message?.includes('40') || error?.message?.includes('Unauthorized')) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false, // Prevent jarring layout refetches in mobile React Native
      refetchOnReconnect: true,    // Auto-refresh when cellular/wifi reconnects
    },
    mutations: {
      retry: 0, // Fail immediately for mutations so optimistic updates can roll back and notify user
    },
  },
});

export const CACHE_TIMES = {
  // Shifts update when managers publish schedules or accept swaps; 2 mins freshness is optimal
  SHIFTS_STALE_MS: 2 * 60 * 1000,
  // Team members list changes infrequently; 5 mins freshness prevents repeat network hits
  TEAM_STALE_MS: 5 * 60 * 1000,
  // User settings are stable and edited only by the authenticated user; 5 mins freshness
  SETTINGS_STALE_MS: 5 * 60 * 1000,
  // Activity feed cursor pages stay immutable once fetched; 3 mins freshness
  ACTIVITY_STALE_MS: 3 * 60 * 1000,
  // Business metadata & settings; 5 mins freshness
  BUSINESS_STALE_MS: 5 * 60 * 1000,
};
