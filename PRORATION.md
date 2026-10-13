# ROTA — Subscription Proration, Payments, and Immutable Ledger Documentation

This document specifies the deterministic mathematical formula, rounding rules, immutable ledger design, and webhook processing pipeline implemented for **Requirement 5: Payments and Proration**.

---

## 1. Subscription Plans & Pricing Structure

All monetary values are strictly stored and computed as **integer cents** (minor currency units) to avoid JavaScript floating-point rounding errors (`BILL-003`).

| Plan | Base Monthly Price | Seats Included | Extra Seat Pricing |
| :--- | :--- | :--- | :--- |
| **Starter** | **$20.00** (`2000` cents) | Up to 5 seats | *Not available* (hard block) |
| **Team** | **$50.00** (`5000` cents) | Up to 15 seats | **$3.00** (`300` cents) / month / seat |
| **Business** | **$120.00** (`12000` cents) | Up to 40 seats | **$2.00** (`200` cents) / month / seat |

---

## 2. Proration Mathematical Formula & Rounding Rules

Proration is calculated **entirely on the server** without relying on third-party provider calculations.

### Variables:
- $T$: Total billing period length in days (typically 30 days).
  $$T = \max\left(1, \text{round}\left(\frac{\text{PeriodEnd} - \text{PeriodStart}}{86400000}\right)\right)$$
- $R$: Days remaining in the active billing period at the time of change.
  $$R = \max\left(0, \min\left(T, \text{round}\left(\frac{\text{PeriodEnd} - \text{ChangeDate}}{86400000}\right)\right)\right)$$
- $C_{\text{current}}$: Monthly cost of current plan and seats in cents.
- $C_{\text{new}}$: Monthly cost of proposed plan and seats in cents.

### Rounding Rule:
All fractional cents are rounded down using `Math.floor()` (integer floor division) to prevent overcharging customers and ensure consistent deterministic reconciliation.

### Formulas:
1. **Unused Credit for Current Plan**:
   $$\text{Credit}_{\text{unused}} = \left\lfloor \frac{C_{\text{current}} \times R}{T} \right\rfloor$$

2. **Cost of New Plan for Remaining Days**:
   $$\text{Cost}_{\text{remaining}} = \left\lfloor \frac{C_{\text{new}} \times R}{T} \right\rfloor$$

3. **Immediate Charge for Upgrades and Seat Increases** ($C_{\text{new}} \ge C_{\text{current}}$):
   $$\text{Charge}_{\text{today}} = \max\left(0, \text{Cost}_{\text{remaining}} - \text{Credit}_{\text{unused}}\right)$$
   *Effective immediately on `ChangeDate`.*

4. **Downgrade Rule** ($C_{\text{new}} < C_{\text{current}}$):
   $$\text{Charge}_{\text{today}} = 0$$
   *Downgrades (or seat reductions) take effect at the end of the paid billing period (`currentPeriodEnd`). This protects against refund abuse and chargeback risk while honoring the already-paid service period.*

---

## 3. The 8+ Specification Test Scenarios

The suite [`Backend/src/test_proration_unit.ts`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/Backend/src/test_proration_unit.ts) tests all specification cases:

### Case 1: Mid-Cycle Upgrade (Ifeanyi's Cafe Scenario)
- **Current**: Starter (5 seats, $20 = 2000 cents).
- **New**: Team (15 seats, $50 = 5000 cents).
- **Timing**: 30-day period (1st to 1st). Upgraded on the 11th ($R = 20$ days left).
- **Credit**: $\lfloor 2000 \times 20 / 30 \rfloor = 1333$ cents.
- **New Cost**: $\lfloor 5000 \times 20 / 30 \rfloor = 3333$ cents.
- **Charge Today**: $3333 - 1333 = 2000$ cents (**$20.00**).
- **Result**: ✅ Verified. Next month bills full $50.00.

### Case 2: Mid-Cycle Downgrade
- **Current**: Team ($50 = 5000$ cents).
- **New**: Starter ($20 = 2000$ cents).
- **Timing**: Day 11 ($R = 20$ days left).
- **Charge Today**: **$0.00** (`chargeTodayCents = 0`).
- **Scheduled**: Change queued for `currentPeriodEnd`.

### Case 3: Adding Extra Seats Mid-Cycle
- **Current**: Team 15 seats ($5000$ cents).
- **New**: Team 18 seats ($5000 + 3 \times 300 = 5900$ cents).
- **Timing**: Day 16 ($R = 15$ days left out of 30).
- **Credit**: $\lfloor 5000 \times 15 / 30 \rfloor = 2500$ cents.
- **New Cost**: $\lfloor 5900 \times 15 / 30 \rfloor = 2950$ cents.
- **Charge Today**: $2950 - 2500 = 450$ cents (**$4.50**).

### Case 4: Removing Extra Seats Mid-Cycle
- **Current**: Team 18 seats ($5900$ cents).
- **New**: Team 15 seats ($5000$ cents).
- **Charge Today**: **$0.00** (downgrade rule applies; effective at end of cycle).

### Case 5: Plan Change on Day 1 (First Day)
- **Current**: Starter ($2000$ cents).
- **New**: Business ($12000$ cents, 40 seats).
- **Timing**: Day 0 ($R = 30$ days left out of 30).
- **Credit**: $\lfloor 2000 \times 30 / 30 \rfloor = 2000$ cents.
- **New Cost**: $\lfloor 12000 \times 30 / 30 \rfloor = 12000$ cents.
- **Charge Today**: $12000 - 2000 = 10000$ cents (**$100.00**).

### Case 6: Plan Change on Day 30 (Last Day)
- **Current**: Starter ($2000$ cents).
- **New**: Team ($5000$ cents).
- **Timing**: Day 30 ($R = 0$ days left out of 30).
- **Credit**: $0$ cents.
- **New Cost**: $0$ cents.
- **Charge Today**: **$0.00** (full new rate begins on renewal).

### Case 7: Two Changes in One Billing Period
- **First Change**: Day 11 (20 days left): Starter ($2000$) $\rightarrow$ Team ($5000$). Charged **$20.00** ($2000$ cents).
- **Second Change**: Day 21 (10 days left): Team ($5000$) $\rightarrow$ Business ($12000$).
  - Unused Team credit: $\lfloor 5000 \times 10 / 30 \rfloor = 1666$ cents.
  - Business cost for remaining 10 days: $\lfloor 12000 \times 10 / 30 \rfloor = 4000$ cents.
  - Charge Today: $4000 - 1666 = 2334$ cents (**$23.34**).

### Case 8: Business Plan with Extra Seats
- **Current**: Business 40 seats ($12000$ cents).
- **New**: Business 45 seats ($12000 + 5 \times 200 = 13000$ cents).
- **Timing**: Day 16 ($R = 15$ days left).
- **Charge Today**: $6500 - 6000 = 500$ cents (**$5.00**).

### Case 9: Hard Seat Limit Violation on Starter
- Attempting to purchase 6 seats on Starter is blocked with an explicit error: `"Plan Starter does not support extra seats beyond 5."`

---

## 4. Immutable Ledger Table Architecture

The `billing_ledgers` table is an **append-only, immutable financial log**:
- Rows are **never updated or deleted**.
- Financial corrections are inserted as new rows with `type: 'CORRECTION'`.
- Running balances (`balanceAfterCents`) provide real-time auditing.

### Ledger Schema
```prisma
model BillingLedger {
  id                String          @id @default(cuid())
  businessId        String
  subscriptionId    String?
  type              LedgerEntryType // CHARGE, CREDIT, REFUND, CORRECTION
  amountCents       Int             // Integer cents
  balanceAfterCents Int             // Cumulative balance
  description       String
  referenceId       String?         // txRef, paymentId, or correction reference
  idempotencyKey    String?         @unique
  metadata          Json?
  createdAt         DateTime        @default(now())
}
```

### State Rebuilding
[`LedgerService.rebuildSubscriptionStateFromLedger(businessId)`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/Backend/src/modules/billing/ledger.service.ts#L79-L126) scans the chronological ledger rows to reconstruct total charges, credits, refunds, and net account balance without relying on mutable cached fields.

---

## 5. Webhook Security & Background Job Processing

1. **Signature Verification**: Every incoming webhook header is verified against `verif-hash` matching the server secret. Unauthenticated or tampered calls are rejected with `401 Unauthorized`.
2. **Server-Side Authoritative Decision**: The client app never decides if a payment succeeded. State mutations occur strictly upon webhook receipt.
3. **BullMQ Worker Dispatch**: Valid webhooks are pushed to the Redis-backed BullMQ `webhook-processing-queue`.
4. **Idempotency**: Webhook events are tracked in `webhook_events` by `eventId`. Duplicate deliveries are detected and safely ignored.

---

## 6. Server-Side Seat Limit Enforcement

When an Owner or Manager invites a team member ([`POST /api/businesses/:businessId/invitations`](file:///c:/Users/Biggest%20Sam/Desktop/ROTA/Backend/src/modules/team/team.service.ts#L110-L141)):
$$\text{AllocatedSeats} = \text{ActiveMembersCount} + \text{PendingInvitationsCount}$$
- If $\text{AllocatedSeats} \ge \text{PlanSeatLimit}$, the server returns `400 Bad Request`:
  `"Seat limit reached (5 seats). An owner on STARTER cannot invite additional members without upgrading or adding seats."`

---

## 7. Failed Renewal & Grace Period Handling

When a renewal payment fails (`charge.failed`):
1. Subscription status changes to `PAST_DUE`.
2. A 7-day grace period is initiated (`gracePeriodEnd`).
3. An audit log event (`PAYMENT_FAILED_GRACE_PERIOD_STARTED`) notifies the owner.
4. If payment is not resolved before `gracePeriodEnd`, status transitions to `EXPIRED`, locking write access to schedules while preserving historical data.
