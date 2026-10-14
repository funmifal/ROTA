import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState, AppStateStatus, Platform } from 'react-native';

// Synchronize React Native AppState with TanStack Query focusManager
// Automatically triggers foreground refetches when user switches back to the app
AppState.addEventListener('change', (status: AppStateStatus) => {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
});

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
      refetchOnWindowFocus: true,  // Auto-refresh when app comes to foreground
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
