# Database Sharding Design & Architecture

## 1. Executive Summary & Purpose

Rota is a multi-tenant workforce management and shift scheduling platform for businesses (restaurants, healthcare clinics, retail stores, and service companies).

As tenant count and shift volume scale past millions of records, single-instance PostgreSQL databases face physical I/O boundaries (disk IOPS, buffer cache saturation, table lock contention). To support horizontal database scaling, Rota implements database sharding.

This document details:
1. **The Shard Key Selection** and mathematical distribution.
2. **Handling Very Large Teams** (The "Monster Tenant" / "Hot Shard" problem).
3. **Cross-Shard Query Bottlenecks** and architectural trade-offs.

---

## 2. Shard Key Selection: `team_id` (`business_id`)

### 2.1 Why `team_id` is the Optimal Shard Key

The choice of shard key dictates whether queries run locally on a single shard or require distributed coordination across multiple nodes.

In Rota, **`team_id` (`business_id`) is the authoritative shard key.**

```text
Incoming Request (/api/businesses/:businessId/shifts)
                     │
                     ▼
          FNV-1a Hash(businessId)
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
    Hash % 2 == 0           Hash % 2 == 1
         │                       │
         ▼                       ▼
   ┌───────────┐           ┌───────────┐
   │  Shard 1  │           │  Shard 2  │
   │ (shard_1) │           │ (shard_2) │
   └───────────┘           └───────────┘
```

### 2.2 Key Benefits of Tenant-Level Sharding

1. **Natural Boundary of Data Isolation**:
   Rota's security and data isolation rules (`AUTHZ-003`, `DATA-001`) mandate that no business may ever access or see another business's schedules, shifts, or members. Every scheduling operation is strictly scoped by `businessId`.

2. **Zero Cross-Shard Joins for Core Workflows**:
   - Creating a shift (`Shift`)
   - Assigning a team member (`ShiftAssignment` $\leftrightarrow$ `Membership`)
   - Requesting and approving a shift swap (`SwapRequest`)
   - Publishing weekly schedules
   All entities required for these operations share the same `businessId`. Therefore, **100% of scheduling mutations and relational joins execute on a single physical database shard with full ACID transaction guarantees.**

3. **High-Entropy Distribution**:
   By using the **FNV-1a 32-bit hashing algorithm** (`hash(team_id) % N_SHARDS`), tenant IDs are uniformly scattered across available shards, avoiding hash collisions and hotspot clustering.

---

## 3. How to Handle a Very Large Team (The Monster Tenant Problem)

### 3.1 The Problem
If a large hospital network or national supermarket chain joins Rota with 50,000 staff members, 100,000 monthly shifts, and thousands of concurrent swap requests, placing this tenant on a shared shard will saturate CPU, memory, and disk I/O, degrading performance for all neighboring tenants on that shard (the "Noisy Neighbor" effect).

### 3.2 Architectural Strategies for Monster Tenants

1. **Dedicated Single-Tenant Shard (Tier Isolation)**:
   - Identify enterprise accounts based on seat tier (`BUSINESS` plan with $>500$ seats) or active monthly shifts.
   - Maintain a shard routing lookup catalog in Redis / Metadata DB:
     ```json
     {
       "tenant_megaclinic_123": { "shard": "shard_dedicated_enterprise_01" }
     }
     ```
   - Enterprise tenants are routed to dedicated, independently scaled database instances with isolated IOPS and memory.

2. **Hierarchical / Secondary Sharding (`team_id` + `location_id` / `department_id`)**:
   - For a single massive enterprise, partition within the tenant by physical operational boundaries:
     - `Shard Key = (businessId, locationId)`
   - Emergency Department, Pediatric Ward, and Surgery Clinic live on separate shards. Shift scheduling within a department remains local to that shard.

3. **Temporal (Time-Based) Range Partitioning**:
   - Within each shard, table partitioning by shift date ranges:
     - Active / Upcoming Shifts: Fast in-memory SSD partition.
     - Historical Shifts ($>90$ days old): Compressed, read-only cold storage partition.
   - Prevents multi-million row historical logs from slowing down real-time scheduling.

---

## 4. Which Queries Became Harder?

Sharding guarantees linear write scalability, but introduces distinct distributed computing challenges. The following queries become significantly more complex:

### 4.1 Global User Lookups & Multi-Tenant Login
- **Scenario**: A user logs in with email `halima@example.com`. The user might belong to a clinic on `Shard 1` and a pharmacy on `Shard 2`.
- **Why it is harder**: Querying `SELECT * FROM memberships WHERE userId = :id` cannot target a single shard because the database does not know which shards hold Halima's memberships without querying all shards (a "Scatter-Gather" query).
- **Solution in Rota**:
  Maintain a centralized **Global User Catalog** on the Primary database or volatile Redis index (`user:${userId}:tenants`) that stores the user's account and a map of `{ businessId: shardId }`. The client resolves the active business before dispatching shard-scoped queries.

### 4.2 Cross-Team Global Analytics & Admin Reports
- **Scenario**: Platform administrators running system-wide analytics: "How many total shifts were completed across all businesses in Nigeria this month?"
- **Why it is harder**: Cannot execute a single SQL `COUNT(*)` or `SUM()`. The query must be executed on Shard 1 and Shard 2 independently, and their results combined in the application layer.
- **Solution in Rota**:
  Never execute operational analytics on production transactional shards. Ingest shift audit logs and payment events into an asynchronous ClickHouse or Snowflake Data Warehouse via BullMQ event streams.

### 4.3 Distributed Transactions (Two-Phase Commit / 2PC)
- **Scenario**: If a future feature allows cross-business shift exchanges (e.g., sharing float staff between allied hospitals on different shards).
- **Why it is harder**: PostgreSQL cannot natively guarantee ACID atomicity across separate physical network databases without two-phase commit (2PC) or the SAGA pattern.
- **Solution in Rota**:
  Avoid cross-tenant distributed database transactions. Staff shifts remain strictly encapsulated within the boundary of a single business tenant.

---

## 5. Verification & Implementation Reference

- Shard Router Implementation: [`Backend/src/database/shardingRouter.ts`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/Backend/src/database/shardingRouter.ts)
- Automated Shard Verification Test: [`Backend/src/test_sharding_simulation.ts`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/Backend/src/test_sharding_simulation.ts)
- Read-Your-Own-Writes Router: [`Backend/src/database/dbRouter.ts`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/Backend/src/database/dbRouter.ts)
