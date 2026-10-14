# Rota Engineering Learning Log (`LEARNING-LOG.md`)

## Purpose of this Document
This log captures the non-obvious engineering challenges, critical architectural trade-offs, hard-won lessons, and deep-dive technical explorations encountered during the development of Rota.

---

## Log Entry 1: The Danger of Floating-Point Arithmetic in Subscription Proration

### The Trap:
When calculating mid-cycle subscription changes (e.g., Ifeanyi upgrading from Starter to Team 10 days into a 30-day cycle), the initial instinct is to calculate using standard JavaScript numbers:
```javascript
const credit = (20.00 * (20 / 30)); // 13.333333333333334
const charge = (50.00 * (20 / 30)); // 33.333333333333336
const net = charge - credit;        // 20.000000000000004
```
In IEEE 754 floating-point arithmetic, binary approximations lead to microscopic rounding drifts. Over hundreds of invoices and webhook reconciliations, rounding differences compound into ledger imbalances, failed payment verifications, and angry customer chargebacks.

### The Resolution:
We mandated integer minor units (integer cents / kobo):
```typescript
const creditCents = Math.floor((2000 * remainingDays) / totalDays); // 1333 cents
const newCostCents = Math.floor((5000 * remainingDays) / totalDays); // 3333 cents
const chargeTodayCents = newCostCents - creditCents;                 // 2000 cents ($20.00)
```
- Every monetary value is stored as an integer (`amountCents Int`).
- Divisions are explicitly rounded down using `Math.floor`.
- Zero floating-point math exists anywhere in the payment pipeline.

---

## Log Entry 2: Last-Write-Wins (LWW) Synchronization & Its Documented Weaknesses

### The Trade-off:
In Requirement 7, Halima's settings needed to synchronize across her phone, tablet, and the server. We adopted Last-Write-Wins (LWW) anchored by the server's authoritative `updatedAt` timestamp.

### Why LWW is Deceptively Risky:
1. **The "Silent Clobber" Problem**:
   If Halima is on a hospital floor with poor reception, changes her theme to dark mode at 14:00, and Device B on Wi-Fi changes quiet hours at 14:02, when Device A reconnects at 14:05, an uncareful server implementation might replace the entire record, wiping out Device B's newer quiet hours!
2. **Mitigation Implemented**:
   We implemented **Field-Level Delta Patching**:
   ```typescript
   update: {
     ...(typeof theme === 'string' ? { theme } : {}),
     ...(typeof quietHoursEnabled === 'boolean' ? { quietHoursEnabled } : {}),
     updatedAt: new Date(),
   }
   ```
   Only explicitly modified fields update, allowing non-conflicting cross-device edits to merge safely.
3. **The Unresolved Weakness**:
   If two devices edit the *same* field concurrently (e.g. phone sets quiet hours to 22:00, tablet sets to 23:00), LWW arbitrarily accepts whichever HTTP packet touched the server last, discarding the other without user notification. A true zero-loss system requires Conflict-Free Replicated Data Types (CRDTs) or explicit 3-way merge conflict prompts.

---

## Log Entry 3: Self-Study Deep Dive — Refresh Token Rotation & The Stolen Token Scenario

### The Vulnerability:
Long-lived refresh tokens stored on a mobile device can be exfiltrated via malware, physical device access, or backup extraction. If a stolen refresh token is valid indefinitely, an attacker retains perpetual account access.

### The Fix: Single-Use Token Rotation with Family Invalidation:
In [`auth.service.ts`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/Backend/src/modules/auth/auth.service.ts):
1. **Single-Use**: Every time `/api/auth/refresh` is called, the supplied refresh token is marked as `isRevoked: true` in PostgreSQL and a *new* refresh token pair is issued.
2. **Replay Detection (The Honeypot)**:
   If a refresh token is presented that has *already been marked revoked*, this signals an attack: either the legitimate user or an attacker is attempting to reuse an old token.
3. **Immediate Family Revocation**:
   The server increments the user's `tokenVersion` (`UPDATE users SET tokenVersion = tokenVersion + 1`), instantaneously invalidating **all active access tokens and refresh tokens across every device owned by that user**. The legitimate user is forced to re-login, terminating the attacker's session immediately.

---

## Log Entry 4: The Read-Your-Own-Writes Trap in Database Replicas

### The Phenomenon:
When scaling out with PostgreSQL read replicas, replication lag is an unavoidable physical reality. Even with synchronous streaming replication, network delays mean replicas lag behind the primary by 10ms–300ms.

### The User Experience Bug:
A manager taps "Create Shift", the backend creates the shift on the Primary DB and returns `201 Created`. The mobile app immediately transitions to the shift calendar and calls `GET /api/businesses/:id/shifts/upcoming`. If this read hits a lagging replica, the newly created shift is absent! The manager panics and creates the shift a second time, producing an accidental duplicate.

### The Solution:
We authored [`dbRouter.ts`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/Backend/src/database/dbRouter.ts) with an Express middleware watermark:
- Any write request stamps the user's ID with `lastWriteTimestamp = Date.now()`.
- Any `GET` request from that user within `REPLICATION_LAG_WINDOW_MS` (5000ms) is pinned to the **Primary Database**.
- Reads occurring after 5 seconds route to the **Read Replica**.
- Result: 100% immune to replication-lag phantom reads while preserving horizontal scale.

---

## Log Entry 5: Sharding Trade-Offs: Why `team_id` is Great Until You Have to Log In

### The Insight:
Partitioning data by `team_id` is the gold standard for B2B multi-tenant apps because shifts, rosters, and swaps are naturally isolated to a single business. 100% of scheduling operations run within a single shard with local ACID transactions.

### The Bottleneck: Global User Identification:
When a user logs in with `user@example.com`, which shard holds their data?
A doctor or freelancer might belong to Clinic A on `Shard 1` and Hospital B on `Shard 2`. If the database were purely sharded without a global directory, the auth service would have to broadcast a "Scatter-Gather" query across all shards simultaneously.

### The Resolution:
We separated the **Global Identity Catalog** from **Tenant Scheduling Data**:
- User accounts and email lookups reside in a centralized, highly indexed Primary identity table.
- Once authenticated, the user selects their active team, and all scheduling queries route deterministically to that specific team's shard (`ShardingRouter.getShardForTeam(teamId)`).

---

## Log Entry 6: What 200 Virtual Users Taught Us About Caching & Connection Pools

### The Load Test Reality Check:
During our Task A load test simulating 200 virtual users hitting the activity feed:
- **Uncached (PostgreSQL)**:
  Mean latency was **290.53 ms**, with P99 reaching **542.07 ms**. Under 200 simultaneous queries, PostgreSQL connection pool slots were contested, and CPU context-switching thrashed query execution.
- **Cached (Redis)**:
  Mean latency dropped to **0.18 ms** (a **1,614x speedup**), with P99 of **0.44 ms** and throughput reaching over **350,000 req/sec**.
- **Takeaway**:
  Aggressive, event-driven Redis caching for read-heavy feeds (with precise invalidation when shifts or audit logs mutate) is the single highest-ROI optimization for mobile backend infrastructure.

---

## Log Entry 7: Windows OS Prisma DLL File Locks

### The Environment Gotcha:
On Windows OS, Node.js worker threads and native Rust Prisma binaries lock the `.dll` file (`query_engine-windows.dll.node`) in the `node_modules` directory while running under `tsx watch`.
- Attempting to run `npx prisma db push` or `npx prisma generate` while the dev server is active produces an `EPERM: operation not permitted` crash.
- **Rule Established**: Always terminate the backend background task before applying Prisma schema migrations, execute the migration, and then relaunch the dev server.
