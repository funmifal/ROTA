import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, UserSettings } from '../../services/api';
import { useAppStore } from '../../state/useAppStore';
import { CACHE_TIMES } from '../../lib/queryClient';

/**
 * Custom TanStack Query Hook: useUserSettings
 * Fetches user settings with 5-minute sensible staleTime.
 */
export function useUserSettings() {
  return useQuery<UserSettings, Error>({
    queryKey: ['userSettings'],
    staleTime: CACHE_TIMES.SETTINGS_STALE_MS,
    refetchOnWindowFocus: true, // Foreground refetch on device switch
    refetchInterval: 30000,     // Polling interval: 30s to sync across devices without reinstall
    queryFn: async () => {
      const res = await api.getSettings();
      return res.settings;
    },
  });
}

/**
 * Custom TanStack Mutation Hook: useUpdateUserSettings
 * 
 * Optimistic Updates with Rollback for Settings:
 * 1. Cancels outgoing refetches.
 * 2. Takes a snapshot of previous settings.
 * 3. Optimistically updates query cache so switch/toggle changes immediately.
 * 4. Passes clientUpdatedAt snapshot for server conflict resolution (Last-Write-Wins).
 * 5. If server fails (or simulated failure), reverts switch to previous value.
 * 6. Reconciles with server on settle.
 */
export function useUpdateUserSettings() {
  const queryClient = useQueryClient();
  const shouldSimulateSettingsFailure = useAppStore((s) => s.shouldSimulateSettingsFailure);
  const showToast = useAppStore((s) => s.showToast);

  return useMutation<
    { message: string; settings: UserSettings; conflictResolved?: boolean },
    Error,
    Partial<UserSettings>,
    { previousSettings?: UserSettings }
  >({
    mutationFn: async (updatedFields) => {
      if (shouldSimulateSettingsFailure) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        throw new Error('Simulated network error: Could not sync settings with server.');
      }
      return api.updateSettings(updatedFields);
    },

    onMutate: async (newValues) => {
      await queryClient.cancelQueries({ queryKey: ['userSettings'] });

      const previousSettings = queryClient.getQueryData<UserSettings>(['userSettings']);

      if (previousSettings) {
        queryClient.setQueryData<UserSettings>(['userSettings'], {
          ...previousSettings,
          ...newValues,
        });

        // Pass clientUpdatedAt for server conflict detection
        if (previousSettings.updatedAt && !newValues.clientUpdatedAt) {
          newValues.clientUpdatedAt = previousSettings.updatedAt;
        }
      }

      return { previousSettings };
    },

    onError: (err, _variables, context) => {
      if (context?.previousSettings) {
        // Rollback state in cache
        queryClient.setQueryData(['userSettings'], context.previousSettings);
      }
      showToast(`Settings sync failed: ${err.message}. Reverted changes.`, 'error');
    },

    onSuccess: () => {
      showToast('Settings saved & synced across devices.', 'success');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
    },
  });
}
