import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ShiftItem, SwapRequestItem } from '../../services/api';
import { offlineShiftsStorage } from '../../services/offlineShiftsStorage';
import { useAppStore } from '../../state/useAppStore';
import { CACHE_TIMES } from '../../lib/queryClient';

export interface UpcomingShiftsResult {
  shifts: ShiftItem[];
  serverTime: string;
  isOffline: boolean;
  lastUpdated: string | null;
}

/**
 * Custom TanStack Query Hook: useUpcomingShifts
 * 
 * Server State & Offline Synchronization:
 * 1. Reads from server with a 2-minute sensible staleTime.
 * 2. Caches successful server response into AsyncStorage for offline availability.
 * 3. Transparently falls back to AsyncStorage when offline or on network failure,
 *    attaching `isOffline: true` and `lastUpdated` timestamp.
 */
export function useUpcomingShifts(businessId: string | undefined) {
  const isSimulatedOffline = useAppStore((s) => s.isSimulatedOffline);

  return useQuery<UpcomingShiftsResult, Error>({
    queryKey: ['shifts', businessId, { isSimulatedOffline }],
    enabled: Boolean(businessId),
    staleTime: CACHE_TIMES.SHIFTS_STALE_MS,
    queryFn: async () => {
      if (!businessId) {
        return { shifts: [], serverTime: new Date().toISOString(), isOffline: false, lastUpdated: null };
      }

      // If simulated offline mode is activated in UI, force reading from persistent storage
      if (isSimulatedOffline) {
        const cached = await offlineShiftsStorage.getOfflineShifts(businessId);
        if (cached) {
          return {
            shifts: cached.shifts,
            serverTime: cached.lastUpdated,
            isOffline: true,
            lastUpdated: cached.lastUpdated,
          };
        }
        throw new Error('Offline mode active and no locally cached shifts exist.');
      }

      try {
        const res = await api.getUpcomingShifts(businessId);
        // Persist to local storage for offline use (survives app restart)
        await offlineShiftsStorage.saveOfflineShifts(businessId, res.shifts, res.serverTime);
        return {
          shifts: res.shifts,
          serverTime: res.serverTime,
          isOffline: false,
          lastUpdated: res.serverTime,
        };
      } catch (err: any) {
        // Fall back to offline cached storage on connection failure
        const cached = await offlineShiftsStorage.getOfflineShifts(businessId);
        if (cached && cached.shifts.length > 0) {
          return {
            shifts: cached.shifts,
            serverTime: cached.lastUpdated,
            isOffline: true,
            lastUpdated: cached.lastUpdated,
          };
        }
        throw err;
      }
    },
  });
}

/**
 * Custom TanStack Mutation Hook: useRequestSwap
 * 
 * Optimistic Updates with Rollback (Kemi's Scenario):
 * 1. Cancels in-flight queries to prevent overwrite.
 * 2. Captures previous query state snapshot.
 * 3. Immediately updates UI: sets `swapStatus = 'PENDING'` and `canRequestSwap = false`.
 *    The button is instantly disabled, preventing double-tap submissions.
 * 4. If server fails (or simulated failure), rolls back to previous snapshot and alerts user.
 * 5. On settled, triggers background query invalidation to reconcile with server.
 */
export function useRequestSwap(businessId: string) {
  const queryClient = useQueryClient();
  const shouldSimulateSwapFailure = useAppStore((s) => s.shouldSimulateSwapFailure);
  const showToast = useAppStore((s) => s.showToast);

  return useMutation<
    { message: string; swapRequest: SwapRequestItem },
    Error,
    { shiftAssignmentId: string; reason?: string },
    { previousData?: UpcomingShiftsResult }
  >({
    mutationFn: async ({ shiftAssignmentId, reason }) => {
      // Allow testing the rollback path deterministically
      if (shouldSimulateSwapFailure) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        throw new Error('Simulated network error: Failed to submit swap request.');
      }

      return api.requestSwap(businessId, { shiftAssignmentId, reason });
    },

    // Step 1: Optimistic UI Update before network call completes
    onMutate: async ({ shiftAssignmentId }) => {
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ['shifts', businessId] });

      // Snapshot previous data for rollback
      const previousData = queryClient.getQueryData<UpcomingShiftsResult>(['shifts', businessId]);

      // Optimistically update query cache
      if (previousData) {
        queryClient.setQueryData<UpcomingShiftsResult>(['shifts', businessId], {
          ...previousData,
          shifts: previousData.shifts.map((shift) => {
            if (shift.myAssignmentId === shiftAssignmentId) {
              return {
                ...shift,
                swapStatus: 'PENDING',
                canRequestSwap: false, // Immediately disables button to prevent double-tap
              };
            }
            return shift;
          }),
        });
      }

      showToast('Swap requested! Awaiting manager approval.', 'info');
      return { previousData };
    },

    // Step 2: Rollback on Error
    onError: (err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['shifts', businessId], context.previousData);
      }
      showToast(`Request failed: ${err.message}. Rolled back changes.`, 'error');
    },

    // Step 3: Server reconciliation
    onSuccess: (data) => {
      showToast(data.message || 'Swap request recorded.', 'success');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts', businessId] });
      queryClient.invalidateQueries({ queryKey: ['swaps', businessId] });
    },
  });
}
