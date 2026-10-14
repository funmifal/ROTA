# Settings Coordination & Synchronization Architecture

## 1. Problem Statement & Overview

In a multi-device shift scheduling application, user preferences must remain consistent across all physical devices (e.g. mobile phone, tablet, web dashboard) and must be authoritatively enforced by the backend server.

### The Problem Scenario (Halima's Case):
Halima, a nurse manager, configures Quiet Hours from 10:00 PM to 6:00 AM on her mobile phone. If settings were stored only locally on the client:
1. At 2:00 AM, a colleague requests a shift swap.
2. The server sends Halima a push notification because it has no knowledge of her quiet hours.
3. Her tablet, retaining old settings, buzzes as well.
4. If Halima switches phones or logs in on a new device, her preferences are lost, forcing reconfiguration.

### The Solution:
1. **Server as the Single Source of Truth**: User settings reside in PostgreSQL table `user_settings` and are validated by the backend.
2. **Multi-Device Synchronization**: Devices fetch settings on launch, refetch on foreground transition (via React Native `AppState` and TanStack Query `focusManager`), and poll periodically (30s) so changes propagate without requiring app reinstallation.
3. **Server-Enforced Quiet Hours**: Background notification workers check quiet hours in the user's specific IANA timezone before dispatching push notifications. Non-urgent notifications are delayed until quiet hours end (e.g., 6:00 AM).
4. **Optimistic Updates with Rollback**: Client UI updates switches and preferences immediately for fluid UX, and reverts to previous state with an error toast if server persistence fails.

---

## 2. Server Data Model (`user_settings`)

Settings are stored in the PostgreSQL `user_settings` table:

```prisma
model UserSettings {
  id                   String   @id @default(cuid())
  userId               String   @unique
  notificationsEnabled Boolean  @default(true)
  notifyShiftChanges   Boolean  @default(true)
  notifySwaps          Boolean  @default(true)
  notifyBilling        Boolean  @default(true)
  quietHoursEnabled    Boolean  @default(false)
  quietHoursStart      String   @default("22:00")
  quietHoursEnd        String   @default("08:00")
  timezone             String   @default("Africa/Lagos")
  emailAlerts          Boolean  @default(true)
  shiftReminders       Boolean  @default(true)
  timeFormat24h        Boolean  @default(false)
  autoAcceptSwaps      Boolean  @default(false)
  theme                String   @default("system")
  language             String   @default("en")
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_settings")
}
```

---

## 3. Conflict Resolution Strategy: Last-Write-Wins (LWW)

### 3.1 Mechanism
- Each record in `user_settings` maintains a canonical, server-generated `updatedAt` timestamp (`DateTime @updatedAt`).
- When a device updates settings via `PUT /api/users/settings`, it includes its current local snapshot timestamp (`clientUpdatedAt`).
- The backend evaluates timestamps:
  - If the server has a newer timestamp than `clientUpdatedAt`, a concurrent cross-device update occurred.
  - The server applies **Last-Write-Wins (LWW)**: the newest write operation updates the database and assigns a fresh server timestamp (`updatedAt = new Date()`).
  - The updated settings and server timestamp are returned to the caller, and propagated to other devices on their next sync.

### 3.2 Why Last-Write-Wins Was Chosen
1. **Simplicity & Predictability**: For scalar user configuration flags (theme, language, boolean notification toggles), users expect their most recent tap to reflect reality.
2. **Zero Client State Complexity**: Eliminates the heavy overhead of Operational Transformation (OT) or distributed Conflict-Free Replicated Data Types (CRDTs).
3. **Field-Level Delta Merging**: The backend updates only the specific fields provided in the request body (`prisma.userSettings.update({ data: { ...providedFields } })`), preventing non-conflicting field updates from overwriting each other.

### 3.3 Weaknesses of Last-Write-Wins (LWW)

While effective for user preferences, LWW has three documented weaknesses:

1. **Silent Overwrites / Lost Intent**:
   - If Halima changes `theme: 'dark'` on her tablet at 14:00:00, and toggles `quietHoursEnabled: true` on her phone at 14:00:02 while offline, when the phone reconnects at 14:05:00, its write may overwrite fields updated by the tablet if a full object replacement were used. (Mitigated in Rota by field-level delta patching).
2. **Network Latency & Asymmetry**:
   - An update made earlier in real time by Device A might reach the server *after* an update made by Device B due to poor cellular reception. Under server-timestamp LWW, the older intent arbitrarily overwrites the newer intent.
3. **Absence of 3-Way Merge Prompts**:
   - LWW cannot detect conflicting business intent to prompt the user ("Settings were changed on another device. Do you want to overwrite or keep both?").

---

## 4. Server-Side Quiet Hours & Non-Urgent Notification Delay

### 4.1 Timezone-Aware Evaluation
When an event occurs (e.g., a shift is created or swap requested), the backend notification worker (`notification.queue.ts`):
1. Fetches the recipient's settings (`quietHoursEnabled`, `quietHoursStart`, `quietHoursEnd`, `timezone`).
2. Calculates current local time in the user's specific IANA timezone (e.g., `Europe/London`, `America/New_York`, `Africa/Lagos`) using `Intl.DateTimeFormat`.
3. Checks whether current local time falls between `quietHoursStart` and `quietHoursEnd` (supporting overnight ranges such as 22:00 to 06:00).

### 4.2 Non-Urgent Delay Scheduling
If quiet hours are active:
- **Urgent Notifications** (`isUrgent: true`, such as emergency shift cancellations within 2 hours): Deliver immediately.
- **Non-Urgent Notifications** (`isUrgent: false`, such as general shift assignment or swap proposal):
  1. Computes exact delay in milliseconds until quiet hours end in that user's timezone (`getDelayUntilQuietHoursEnd`).
  2. Enqueues a delayed job in BullMQ:
     ```typescript
     await pushQueue.add('send-push', { ...payload, isDelayedRun: true }, { delay: delayMs });
     ```
  3. The notification silently waits until the user's wake hour (e.g. 6:00 AM local time) before delivering push alerts.

---

## 5. Mobile Client Synchronization & Optimistic Rollback

1. **Foreground Refetching (`focusManager`)**:
   - Integrated with React Native's `AppState` listener in `queryClient.ts`.
   - When the app returns from background to `active`, it immediately refetches `userSettings`.
2. **Periodic Background Polling**:
   - `useUserSettings` hook configures `refetchInterval: 30000` (30 seconds), ensuring settings changed on a tablet appear on a phone within half a minute without restarting the app.
3. **Optimistic Updates & Snapshot Rollback**:
   - When the user toggles a switch, the TanStack Query cache updates instantly.
   - If the network fails, `onError` restores the previous snapshot and displays a feedback banner.
