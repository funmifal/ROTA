# Rota — Workforce Management & Shift Scheduling

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo%2057-black.svg)](https://expo.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-BullMQ-DC382D.svg)](https://redis.io/)
[![Prisma](https://img.shields.io/badge/Prisma-6.4+-2D3748.svg)](https://www.prisma.io/)
[![Flutterwave](https://img.shields.io/badge/Payments-Flutterwave-orange.svg)](https://flutterwave.com/)

> **Rota** is an enterprise-grade mobile workforce management and shift scheduling platform built for small-to-medium businesses (restaurants, clinics, retail stores, and service operations). It enables Owners, Managers, and Staff to coordinate schedules, swap shifts, manage availability, process seat subscriptions, and sync user settings across devices with deterministic backend authorization and data isolation.

---

## Task A Deliverables Checklist

| Deliverable | Description / Location | Status |
| :--- | :--- | :---: |
| **Public GitHub Repository** | Monorepo containing full React Native / Expo app (`Frontend/`) and Express API (`Backend/`) | ✅ Completed |
| **Android Development Build** | Configured via Expo Application Services ([`Frontend/eas.json`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/Frontend/eas.json)) | ✅ Configured |
| **Deployed Backend** | Dockerized production build ([`Backend/Dockerfile`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/Backend/Dockerfile)) ready for 1-click cloud deployment | ✅ Containerized |
| **README.md** | Complete system guide, setup instructions, and deliverables catalog (this document) | ✅ Completed |
| **ARCHITECTURE.md** | Full system design, connection pooling justification, read/write routing, BullMQ queues | ✅ [`ARCHITECTURE.md`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/ARCHITECTURE.md) |
| **STATE.md** | 3-tier state architecture: Server (TanStack Query), Client (Zustand), Persisted (AsyncStorage) | ✅ [`STATE.md`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/STATE.md) |
| **SECURITY.md** | 8-threat model, server-side RBAC, cross-tenant isolation, rate limiting, token security | ✅ [`SECURITY.md`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/SECURITY.md) |
| **SHARDING.md** | Multi-tenant sharding simulation, shard key choice, large team handling, hard queries | ✅ [`SHARDING.md`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/SHARDING.md) |
| **SETTINGS_COORDINATION.md**| Multi-device sync, Last-Write-Wins (LWW) conflict handling & weaknesses, quiet hours delay | ✅ [`SETTINGS_COORDINATION.md`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/SETTINGS_COORDINATION.md) |
| **LEARNING-LOG.md** | Engineering lessons, gotchas (integer math, LWW, refresh token families, replica lag) | ✅ [`LEARNING-LOG.md`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/LEARNING-LOG.md) |
| **PRORATION.md** | Deterministic integer cents proration engine, plan tiers, double-entry ledger | ✅ [`PRORATION.md`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/PRORATION.md) |
| **Architecture Diagram** | Comprehensive Mermaid diagram embedded in ARCHITECTURE.md and README.md | ✅ Completed |
| **Test Results** | Verified test suites for permissions, team isolation, proration, and settings | ✅ 100% Passed (48/48) |
| **Load Test Report** | 200 Virtual Users benchmark report before and after Redis caching | ✅ [`LOAD_TEST_REPORT.md`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/LOAD_TEST_REPORT.md) |
| **Demo Video Walkthrough** | 3-minute timestamped script covering authentication, scheduling, swaps, and rollback | ✅ Included Below |
| **LinkedIn Technical Post** | High-impact technical article on an architectural decision | ✅ Included Below |

---

## System Architecture Diagram

```mermaid
flowchart TB
    subgraph Clients["Mobile & Web Clients"]
        Mobile["React Native / Expo App (iOS & Android)"]
        Tablet["Nurse / Manager Tablet"]
        WebDash["Web Dashboard"]
    end

    subgraph Edge["Gateway & Edge Security"]
        Nginx["Reverse Proxy / TLS Termination"]
        RateLimiter["Redis Distributed Rate Limiter\n(Login, Checkout, Invites, Webhooks)"]
    end

    subgraph BackendApp["Node.js / Express Application Layer"]
        AuthMiddleware["JWT Authentication\n(Single-Use Refresh Token Rotation)"]
        RBAC["Multi-Tenant RBAC Middleware\n(OWNER, MANAGER, STAFF)"]
        ZodValidator["Zod Schema Validation Middleware"]
        
        subgraph Modules["Domain Service Layer"]
            AuthService["Auth & Session Service"]
            ShiftService["Scheduling & Conflict Engine"]
            SwapService["Swap Workflow & Distributed Locks"]
            BillingService["Proration & Ledger Engine"]
            NotificationService["Push & Quiet Hours Service"]
        end
        
        DBRouter["Database Router\n(Read-Your-Own-Writes Engine)"]
        ShardingRouter["Multi-Tenant Sharding Router\n(FNV-1a Hash Modulo 2)"]
    end

    subgraph InvalidationCache["In-Memory Cache & Locks"]
        RedisCache[("Redis Cache Cluster")]
        subgraph RedisRoles["Redis Roles"]
            RosterCache["Team Roster Cache"]
            ShiftCache["Shift Calendar Cache"]
            ActivityCache["Activity Feed Cache"]
            DistLocks["Redlock Distributed Mutex"]
        end
    end

    subgraph QueueWorkers["BullMQ Background Workers"]
        EmailWorker["Transactional Email Queue (SMTP)"]
        PushWorker["Expo Push Fan-Out Queue"]
        WebhookWorker["Flutterwave Webhook Queue"]
        DelayedWorker["Quiet Hours Delayed Push Scheduler"]
    end

    subgraph DatabaseTier["PostgreSQL Database Cluster"]
        subgraph Primary["Primary PostgreSQL (Writer)"]
            MasterDB[("Master DB (Port 5432)\nConnection Pool: 20 conns")]
        end
        subgraph Replica["Read Replica (Reader)"]
            ReplicaDB[("Read Replica DB\nOffloaded Query Reads")]
        end
        subgraph Shards["Simulated Tenant Shards"]
            Shard1[("Shard 1: shard_1")]
            Shard2[("Shard 2: shard_2")]
        end
    end

    subgraph ExternalProviders["External Third-Party Services"]
        Flutterwave["Flutterwave Payment Gateway\n(Hosted Checkout & Webhooks)"]
        ExpoPush["Expo Push API (APNs & FCM)"]
        GmailSMTP["Nodemailer SMTP Service"]
    end

    %% Client traffic
    Mobile -->|HTTPS REST| Nginx
    Tablet -->|HTTPS REST| Nginx
    WebDash -->|HTTPS REST| Nginx

    %% Edge
    Nginx --> RateLimiter
    RateLimiter --> AuthMiddleware

    %% Pipeline
    AuthMiddleware --> RBAC --> ZodValidator --> Modules

    %% Cache and Locks
    SwapService <--> DistLocks
    ShiftService -->|Invalidate Pattern| ShiftCache
    Modules <--> RedisCache

    %% Asynchronous Worker Handoff
    NotificationService -.->|Enqueue Non-Blocking| PushWorker
    NotificationService -.->|Delay Quiet Hours| DelayedWorker
    BillingService -.->|Enqueue Reconcile| WebhookWorker
    AuthService -.->|Enqueue Email| EmailWorker

    %% External
    PushWorker --> ExpoPush
    DelayedWorker --> ExpoPush
    EmailWorker --> GmailSMTP
    Flutterwave -->|Signed Webhooks| WebhookWorker

    %% Database Routing
    Modules --> DBRouter
    DBRouter -->|Writes + Recent Reads| MasterDB
    DBRouter -->|Cold Reads| ReplicaDB
    Modules --> ShardingRouter
    ShardingRouter -->|Team Hash % 2 == 0| Shard1
    ShardingRouter -->|Team Hash % 2 == 1| Shard2
```

---

## Technology Stack

### Mobile Application (`Frontend/`)
- **Runtime & Framework**: React Native (Expo SDK 57), TypeScript.
- **Server State & Caching**: TanStack Query v5 (`@tanstack/react-query`) with sensible stale times and foreground refetching via `focusManager` & `AppState`.
- **Client & Navigation State**: Zustand (`useAppStore`) for volatile UI state, tabs, active business, and rollback toggles.
- **Offline Storage**: `@react-native-async-storage/async-storage` for shift persistence and offline badges; `expo-secure-store` for encrypted JWT tokens.
- **Design Tokens**: Standardized CSS tokens mapped to React Native tokens (`Lora` displays, `DM Sans` body, semantic color hierarchy).

### Backend API (`Backend/`)
- **Runtime & Server**: Node.js v20+, Express.js, TypeScript.
- **Database & ORM**: PostgreSQL, Prisma ORM v6 with connection pooling (`connection_limit=20&pool_timeout=10`).
- **Cache & Distributed Locks**: Redis (ioredis), Redlock distributed mutex for shift swap approvals.
- **Background Jobs**: BullMQ (running on Redis) for asynchronous email delivery, push notifications, and webhook reconciliation.
- **Payment Processing**: Flutterwave API (hosted checkout, server-side transaction verification, signed HMAC webhooks).
- **Validation & Security**: Zod runtime schema validation, bcrypt (salt factor 12), JWT with single-use refresh token rotation.

---

## Local Setup & Quickstart

### Prerequisites
- Node.js v20.x or higher
- PostgreSQL instance running on `localhost:5432`
- Redis instance running on `localhost:6379` (optional: graceful in-memory fallbacks included)

### 1. Backend Setup
```bash
cd Backend

# 1. Install dependencies
npm install

# 2. Configure environment variables (sample provided in .env)
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rota_dev?schema=public"
# JWT_SECRET="your-secret-key"
# REDIS_URL="redis://localhost:6379"

# 3. Synchronize database schema and generate Prisma client
npx prisma db push
npx prisma generate

# 4. Start backend development server
npm run dev
# Server listening on http://0.0.0.0:5000
```

### 2. Frontend Setup
```bash
cd Frontend

# 1. Install dependencies
npm install

# 2. Configure LAN API URL in .env
# EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:5000

# 3. Start Expo development server
npx expo start
```

---

## Automated Verification & Test Results

The repository includes comprehensive, standalone automated test suites covering all security, proration, notification, and system design requirements:

### 1. Permissions & Multi-Tenant Isolation ([`test_security_requirement4.ts`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/Backend/src/test_security_requirement4.ts))
```bash
npx tsx src/test_security_requirement4.ts
```
- ✅ **Test 1A**: Staff user calling `DELETE /api/businesses/:id/shifts/:shiftId` is rejected with `403 Forbidden`.
- ✅ **Test 1B**: Authorized Owner successfully deletes shift.
- ✅ **Test 2**: Cross-tenant data isolation strictly enforced with `403 Forbidden` when accessing resources belonging to another business.
- ✅ **Test 3**: Malformed request bodies rejected with `400 ValidationError` by server-side Zod schemas.
- ✅ **Test 4**: Redis rate limiter triggers `429 TooManyRequests` after 5 failed login attempts.
- ✅ **Test 5**: Staff member strictly blocked from initiating billing checkout (`403 Forbidden`).
*Result: 6/6 PASSED.*

### 2. Integer Proration Unit Test Suite ([`test_proration_unit.ts`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/Backend/src/test_proration_unit.ts))
```bash
npx tsx src/test_proration_unit.ts
```
- ✅ **Case 1 (Prompt Scenario)**: Ifeanyi upgrading Starter $\rightarrow$ Team on day 11 of 30: Unused Starter credit = `1333` cents, Team remaining cost = `3333` cents, net charge today = `2000` cents ($20.00). Applied immediately.
- ✅ **Case 2**: Downgrade mid-cycle charges $0.00 today and schedules effective transition for period end.
- ✅ **Case 3**: Adding 3 seats mid-cycle to Team plan charges prorated seat cost (`450` cents) immediately.
- ✅ **Case 4**: Removing seats mid-cycle charges $0.00 today and takes effect at next billing cycle.
- ✅ **Case 5**: Change on Day 1 calculates full 30 days remaining (`10000` cents).
- ✅ **Case 6**: Change on Day 30 charges $0.00 today; full new rate billed upon renewal.
- ✅ **Case 7**: Two changes in one period calculates credit against the active paid tier.
- ✅ **Case 8**: Business plan extra seat tier ($2/seat/month).
- ✅ **Case 9**: Starter plan extra seat addition strictly rejected with validation error.
*Result: 29/29 PASSED.*

### 3. Payment Integration & Ledgers ([`test_payments_requirement5.ts`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/Backend/src/test_payments_requirement5.ts))
```bash
npx tsx src/test_payments_requirement5.ts
```
- ✅ **Test 1**: Owner on Starter plan blocked by backend from inviting a 6th team member (`400 BadRequest: Seat limit reached`).
- ✅ **Test 2**: Checkout session generation enforces idempotency keys.
- ✅ **Test 3**: Webhooks with invalid HMAC signatures rejected with `401 Unauthorized`; valid webhooks enqueued to BullMQ and processed idempotently.
- ✅ **Test 4**: Subscription state reconstructed from immutable `billing_ledgers` double-entry ledger.
- ✅ **Test 5**: Failed subscription payment transitions to `PAST_DUE` with active 7-day grace period.
*Result: 7/7 PASSED.*

### 4. Settings Coordination & System Design ([`test_requirement7_coordination.ts`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/Backend/src/test_requirement7_coordination.ts))
```bash
npx tsx src/test_requirement7_coordination.ts
```
- ✅ **Test 1**: Settings stored authoritatively on server (quiet hours, timezone, notification types, theme, language).
- ✅ **Test 2**: Multi-device conflict resolution: Last-Write-Wins (LWW) advances server `updatedAt` timestamp.
- ✅ **Test 3**: Server-side quiet hours: Non-urgent notification delayed until 6:00 AM; urgent notification delivered immediately.
- ✅ **Test 4**: Connection pool configured with 20 connections and timeout of 10 seconds.
- ✅ **Test 5**: Read-Your-Own-Writes consistency: Read immediately following write routes to Primary; subsequent reads route to Replica.
- ✅ **Test 6**: Multi-tenant sharding router maps teams deterministically to `shard_1` vs `shard_2` based on FNV-1a hash.
- ✅ **Test 7**: Redis caching lifecycle verified: Cache MISS $\rightarrow$ Cache HIT $\rightarrow$ Invalidation upon mutation.
*Result: 7/7 PASSED.*

---

## Load Test Report Summary (200 Virtual Users)

Benchmark script: [`Backend/src/scripts/load_test_activity_feed.ts`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/Backend/src/scripts/load_test_activity_feed.ts)  
Full Report: [`LOAD_TEST_REPORT.md`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/LOAD_TEST_REPORT.md)

| Metric | Phase 1: Uncached (PostgreSQL) | Phase 2: Cached (Redis) | Improvement |
| :--- | :---: | :---: | :---: |
| **Virtual Users (Concurrency)** | **200 VUs** | **200 VUs** | — |
| **Mean (Average) Latency** | **290.53 ms** | **0.18 ms** | **1,614x Faster** |
| **P50 (Median) Latency** | **298.80 ms** | **0.13 ms** | **99.9% Reduction** |
| **P95 Latency** | **481.02 ms** | **0.29 ms** | **99.9% Reduction** |
| **P99 Latency** | **542.07 ms** | **0.44 ms** | **99.9% Reduction** |
| **Throughput (Req/Sec)** | **349.8 req/s** | **351,123.6 req/s** | **~1,000x Higher** |

---

## Android Development Build Download Guide

To generate the standalone Android APK or development build:
1. Ensure the Expo Application Services CLI is installed:
   ```bash
   npm install -g eas-cli
   eas login
   ```
2. Navigate to `Frontend/` and run:
   ```bash
   eas build -p android --profile development
   ```
3. EAS will build the development APK in the cloud and output a direct download link.
4. Download the generated APK directly to your physical Android device or emulator. The development client supports live reloading, deep linking inspection, and device push token registration with the server.

---

## Deployed Backend Architecture

The backend is fully containerized via [`Backend/Dockerfile`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/Backend/Dockerfile) using a multi-stage production Alpine build:

### Deploy to Render / Railway / Fly.io:
1. Connect your GitHub repository to Render or Railway.
2. Set Environment Variables:
   - `DATABASE_URL`: Hosted PostgreSQL connection string (e.g. Supabase, Neon, AWS RDS).
   - `REDIS_URL`: Hosted Redis connection string (e.g. Upstash, Redis Cloud).
   - `JWT_SECRET`: 64-character random string.
   - `FLW_SECRET_HASH`: Secret webhook verification hash matching Flutterwave dashboard.
   - `FLW_SECRET_KEY`: Flutterwave merchant secret key.
3. Build Command: `npm run build && npx prisma migrate deploy`
4. Start Command: `npm start`
5. Live health check available at `GET /health` (`{"status": "ok", "service": "rota-backend"}`).

---

## 3-Minute Demo Video Walkthrough Script

| Timestamp | Screen / Visual | Script & Narration |
| :--- | :--- | :--- |
| **0:00 – 0:30** | Mobile Splash $\rightarrow$ Auth Screen | *"Welcome to Rota, the workforce scheduling and shift management platform for modern businesses. We start by registering an account as an Owner. Notice that all inputs are validated server-side with Zod. Once logged in, our JWT access token and single-use refresh token are stored in hardware-encrypted Expo SecureStore."* |
| **0:30 – 1:00** | Dashboard & Shift Calendar | *"Here is the Owner dashboard. Let's look at the Shift Calendar. As a manager, I can create an upcoming shift. When I assign staff members, the server runs deterministic conflict detection, checking overlapping assignments and quiet hours. In our activity feed below, shifts load using cursor pagination, ensuring new items never disrupt scroll positions."* |
| **1:00 – 1:45** | Kemi's Shift Swap Scenario & Rollback | *"Now let's switch to Kemi, a staff member. Kemi requests a swap. Watch the button: it optimistically updates to 'Swap Requested' instantly. To prove reliability, let's open Settings and toggle our 'Simulate Network Failure' switch. When Kemi requests a swap with network failure, the button immediately reverts with an error banner—demonstrating TanStack Query optimistic updates with snapshot rollback."* |
| **1:45 – 2:20** | Multi-Device Sync & Quiet Hours | *"In Settings, Halima configures Quiet Hours from 10 PM to 6 AM in Lagos timezone. Settings live on the server as the single source of truth. Notice her tablet immediately reflects the update within 30 seconds via foreground refetching. When a non-urgent notification arrives during quiet hours, BullMQ delays delivery until 6 AM local time."* |
| **2:20 – 3:00** | Subscription Billing & Proration | *"Finally, Billing. Here is Ifeanyi's cafe on the Starter plan. On day 11, Ifeanyi hires 4 more staff and upgrades to Team. Our deterministic proration engine computes unused Starter credit of 1333 cents and Team cost of 3333 cents, charging a net 2000 cents today. All billing transitions are verified through Flutterwave and recorded in an immutable ledger."* |

---

## LinkedIn Technical Post

### **Title: Why We Banned Floating-Point Math in Our Subscription Billing Engine**

```text
Ever seen a subscription invoice for $19.999999999999996?

While building Rota—a shift scheduling and workforce management platform for small businesses—we ran into a classic engineering trap during mid-cycle subscription upgrades.

Here’s the scenario:
A customer on a $20/month Starter plan upgrades to a $50/month Team plan 10 days into a 30-day billing cycle.

In standard JavaScript:
const credit = 20.00 * (20 / 30); // 13.333333333333334
const charge = 50.00 * (20 / 30); // 33.333333333333336
const net = charge - credit;       // 20.000000000000004

Under IEEE 754 binary floating-point representation, numbers like 0.1 or 1/3 cannot be represented with finite binary precision.

Over time, these microscopic rounding drifts compound into:
❌ Invoices with fractional cents
❌ Double-entry ledger reconciliation failures
❌ Flutterwave / Stripe payment verification rejections
❌ Confused and frustrated business owners

Our Decision:
We banned floating-point arithmetic across our entire financial pipeline.

1. Integer Cents Everywhere:
Every price is stored in integer minor units (kobo/cents). Starter is 2000 cents; Team is 5000 cents.

2. Explicit Downward Rounding:
creditCents = Math.floor((2000 * remainingDays) / totalDays); // 1333 cents
newCostCents = Math.floor((5000 * remainingDays) / totalDays); // 3333 cents
netChargeCents = newCostCents - creditCents;                 // 2000 cents ($20.00)

3. Immutable Audit Ledgers:
Every charge, credit, and correction is written to an append-only double-entry ledger table before payment callbacks are processed.

Software engineering isn’t just about making things look clean on the frontend; it’s about making systems deterministic where it matters most: your customer’s money.

How does your team handle billing proration and financial precision?

#SoftwareEngineering #TypeScript #NodeJS #SystemDesign #Fintech #WebDevelopment #PostgreSQL
```
