# Rota State Management Architecture (STATE.md)

## 1. Overview & Architectural Principles

Rota manages workforce scheduling and shift operations across mobile (iOS & Android) and web clients. For mobile applications used by on-the-ground employees (waiters, nurses, retail clerks), responsiveness, deterministic data integrity, and offline availability are critical.

To achieve this, Rota partitions all application data into three distinct layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          ROTA STATE TAXONOMY                           │
├─────────────────────────┬─────────────────────────┬────────────────────┤
│      SERVER STATE       │      CLIENT STATE       │  PERSISTED STATE   │
├─────────────────────────┼─────────────────────────┼────────────────────┤
│ • Shifts & Rosters      │ • Current Tab           │ • Offline Shifts   │
│ • Shift Assignments     │ • Active Business       │ • Last Sync Stamp  │
│ • Swap Requests         │ • Modal Visibility      │ • Auth JWT Token   │
│ • Team Members          │ • Filter Selection      │                    │
│ • Cursor Activity Feed  │ • Offline Sim Toggles   │                    │
│ • User Settings         │ • Toast Notifications   │                    │
├─────────────────────────┼─────────────────────────┼────────────────────┤
│ Tool: TanStack Query v5 │ Tool: Zustand           │ Tool: AsyncStorage │
│ (Server Cache + Synced) │ (Volatile App UI State) │ & SecureStore      │
└─────────────────────────┴─────────────────────────┴────────────────────┘
```

---

## 2. Complete Data Mapping

| Data Entity | State Kind | Storage / Tool | Cache / Stale Time | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Upcoming Shifts** | Server State + Persisted | TanStack Query + AsyncStorage | `staleTime: 2m`<br>`gcTime: 10m` | Shifts change on manager publication or swap approval. Cached to AsyncStorage so frontline staff can review rosters offline. |
| **Shift Swaps** | Server State | TanStack Query (`['swaps', bizId]`) | `staleTime: 1m`<br>`gcTime: 5m` | High concurrency; requires immediate visibility of pending approvals and optimistic UI rollback. |
| **Team Members & Invites** | Server State | TanStack Query (`['members', bizId]`) | `staleTime: 5m`<br>`gcTime: 15m` | Team roster changes infrequently; 5-minute freshness avoids unnecessary network traffic. |
| **Activity Feed (Cursor Paginated)** | Server State | TanStack Query (`['activity', bizId]`) | `staleTime: 3m`<br>`gcTime: 10m` | Paginated chronological audit entries are append-only; historical pages remain immutable. |
| **User Settings** | Server State | TanStack Query (`['userSettings']`) | `staleTime: 5m`<br>`gcTime: 15m` | Synced across all user devices. Optimistically toggled with immediate local rollback on failure. |
| **Active Business Selection** | Client State | Zustand (`useAppStore.activeBusiness`) | Ephemeral (Session) | Belongs to client navigation context; persists in memory during active app use. |
| **Active Screen / Tab** | Client State | Zustand (`useAppStore.activeTab`) | Ephemeral (Session) | Volatile UI state determining active route (`dashboard`, `shifts`, `activity`, `team`, `settings`). |
| **Modal Visibility** | Client State | Zustand (`useAppStore.isCreateBusinessModalOpen`) | Ephemeral (UI) | Controls whether overlay dialogs are open or closed without polluting component prop trees. |
| **Testing Simulation Flags** | Client State | Zustand (`useAppStore.isSimulatedOffline`) | Ephemeral (UI) | Allows developer/tester to toggle simulated offline reading and server swap failures on demand. |
| **Transient Toast Notifications** | Client State | Zustand (`useAppStore.toastMessage`) | Ephemeral (4s timer) | Non-blocking user feedback for optimistic actions, errors, and rollback notifications. |
| **Auth JWT Token** | Persisted State | Expo SecureStore | Survives app close | Stored securely in hardware-backed keystore/keychain for biometric & session persistence. |
| **Cached Upcoming Shifts** | Persisted State | `@react-native-async-storage/async-storage` | Indefinite until refreshed | Enables offline viewing when workers enter basements, walk-in freezers, or areas with poor reception. |
| **Last Shift Sync Timestamp** | Persisted State | `@react-native-async-storage/async-storage` | Updated on fetch | Displayed to user as a visible badge: `"Offline View • Last updated: 05:42 PM"`. |

---

## 3. Server State: TanStack Query

### Why TanStack Query?
1. **Separation of Concerns:** Eliminates the anti-pattern of manually synchronizing remote data into Redux or Context via `useEffect`.
2. **Automatic Background Refetching:** Re-authenticates and refetches stale data upon network reconnect.
3. **Deduplication:** Multiple components requesting upcoming shifts share a single network call.
4. **Structured Mutation Lifecycle:** Native support for `onMutate`, `onError`, and `onSettled` enables predictable optimistic updates with snapshot rollback.

### Cache Timing Strategy (`lib/queryClient.ts`)

```typescript
export const CACHE_TIMES = {
  SHIFTS_STALE_MS: 2 * 60 * 1000,    // 2 minutes
  TEAM_STALE_MS: 5 * 60 * 1000,      // 5 minutes
  SETTINGS_STALE_MS: 5 * 60 * 1000,  // 5 minutes
  ACTIVITY_STALE_MS: 3 * 60 * 1000,  // 3 minutes
  BUSINESS_STALE_MS: 5 * 60 * 1000,  // 5 minutes
};
```

- **`staleTime` (2 to 5 minutes):** Queries remain "fresh" during this window. Navigating between screens or returning from background within 2 minutes instantly serves from memory without any loading spinners.
- **`gcTime` (10 minutes):** Unused queries remain in memory for 10 minutes before garbage collection.
- **`retry: 0` on Mutations:** Mutations fail fast so the user gets immediate error feedback and the UI snapshot rolls back without hanging.

---

## 4. Client State: Zustand

### Architectural Choice & Justification
**Zustand** was selected over Redux and React Context for client state for three primary reasons:

1. **Zero Boilerplate:** No reducers, dispatchers, action creators, or nested Context Providers. The entire store is a concise, type-safe hook (`Frontend/src/state/useAppStore.ts`).
2. **Selective Component Re-renders:** Zustand uses selector subscriptions (`useAppStore(s => s.activeBusiness)`). Only components subscribing to the modified slice re-render, avoiding whole-tree render cascades common in React Native.
3. **No Provider Nesting:** Can be read or modified inside helper functions or outside the React component tree without context wrapping issues.

```typescript
// useAppStore.ts
export const useAppStore = create<AppState>((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  activeBusiness: null,
  setActiveBusiness: (business) => set({ activeBusiness: business }),
  isSimulatedOffline: false,
  setSimulatedOffline: (offline) => set({ isSimulatedOffline: offline }),
  // ...
}));
```

---

## 5. Optimistic Updates with Rollback

### The Problem (Kemi's Scenario)
> *Kemi taps "Request swap" on Rota. The app waits two seconds for the server before showing anything, so she taps again, sending two requests. The developer, Bayo, switches to an optimistic update: the shift instantly shows "Swap requested", the button disables, and if the server fails, the label reverts with an error message. Kemi gets instant feedback and cannot double-submit.*

### Implementation Flow

```
Kemi Taps "Request Swap"
        │
        ▼
1. onMutate Phase (Instantaneous UI)
   ├─ Cancel outgoing refetches for ['shifts', businessId]
   ├─ Snapshot previous query state (for rollback)
   ├─ Optimistically update query cache:
   │    • swapStatus = 'PENDING'
   │    • canRequestSwap = false (Button disabled)
   └─ Return { previousData } context
        │
   ┌────┴───────────────────────────┐
   │                                │
   ▼                                ▼
[Network Success]            [Network Failure]
2. onSuccess Phase           2. onError Phase
   ├─ Toast: "Swap requested"   ├─ Restore cache: queryClient.setQueryData(context.previousData)
   └─ Reconcile onSettled       ├─ Button re-enables; status reverts
                                └─ Toast: "Request failed. Rolled back changes."
        │                                │
        └────────────────┬───────────────┘
                         ▼
                 3. onSettled Phase
                 Invalidate queries to ensure exact server sync
```

### Code Implementation (`Frontend/src/features/shifts/useShiftsQuery.ts`)

```typescript
export function useRequestSwap(businessId: string) {
  const queryClient = useQueryClient();
  const showToast = useAppStore((s) => s.showToast);

  return useMutation({
    mutationFn: ({ shiftAssignmentId, reason }) =>
      api.requestSwap(businessId, { shiftAssignmentId, reason }),

    onMutate: async ({ shiftAssignmentId }) => {
      // 1. Cancel in-flight refetches
      await queryClient.cancelQueries({ queryKey: ['shifts', businessId] });

      // 2. Snapshot current state for rollback
      const previousData = queryClient.getQueryData(['shifts', businessId]);

      // 3. Optimistic UI update: immediate feedback & disabled button
      if (previousData) {
        queryClient.setQueryData(['shifts', businessId], {
          ...previousData,
          shifts: previousData.shifts.map((shift) =>
            shift.myAssignmentId === shiftAssignmentId
              ? { ...shift, swapStatus: 'PENDING', canRequestSwap: false }
              : shift
          ),
        });
      }

      showToast('Swap requested! Awaiting manager approval.', 'info');
      return { previousData };
    },

    onError: (err, _variables, context) => {
      // 4. Rollback to snapshot on server error
      if (context?.previousData) {
        queryClient.setQueryData(['shifts', businessId], context.previousData);
      }
      showToast(`Request failed: ${err.message}. Rolled back changes.`, 'error');
    },

    onSettled: () => {
      // 5. Authoritative server reconciliation
      queryClient.invalidateQueries({ queryKey: ['shifts', businessId] });
      queryClient.invalidateQueries({ queryKey: ['swaps', businessId] });
    },
  });
}
```

### Settings Optimistic Updates (`Frontend/src/features/settings/useSettingsQuery.ts`)
Toggling push notifications, email alerts, or 24-hour time format triggers an optimistic cache write via `useUpdateUserSettings`. The toggle switches instantly without lag; if the server rejects or the device loses connection, the switch flips back to its prior setting with an explanatory error banner.

---

## 6. Persisted State: Offline Shifts Display

### Why Persist Upcoming Shifts?
Frontline shift workers often open scheduling apps in environments with zero cellular coverage (kitchen basements, hospital radiology suites, underground transit). Losing schedule visibility in these situations disrupts operations.

### Storage Mechanics (`Frontend/src/services/offlineShiftsStorage.ts`)
1. **Auto-Persist on Online Query:** Every successful response from `GET /api/businesses/:businessId/shifts/upcoming` is serialized and saved to `@react-native-async-storage/async-storage` under key `@rota_offline_shifts_${businessId}` alongside a UTC `lastUpdated` timestamp.
2. **Transparent Fallback on Offline:** When the network request fails or when simulated offline mode is active, `useUpcomingShifts` reads the cached roster from local storage and returns `{ shifts, isOffline: true, lastUpdated }`.
3. **Visible "Last Updated" Indicator:** The UI renders an unmistakable status pill:
   - **Online:** Green pill `● Live Server Sync • Last updated: 05:42 PM`
   - **Offline:** Amber pill `● Offline Cache Active • Last updated: 05:42 PM`

---

## 7. Testing & Verification

The application includes an in-app **State & Rollback Playground** on both the **Upcoming Shifts** screen and the **Settings** screen:
- **"Simulate Offline Mode":** Instantly disconnects remote calls and reads from persistent AsyncStorage.
- **"Simulate Server Failure on Swap":** Injects a deterministic 500 error after 800ms. Verifies Kemi's scenario: button disables and shows "Swap Requested", then cleanly snaps back to "Request Swap" with a rollback alert.
- **"Simulate Server Sync Failure on Settings":** Verifies instant switch toggles snapping back when server sync fails.
