# AGENTS.md

# Rota Coding Agent Rules

## 1. What Is This Project?

Rota is a mobile shift scheduling and workforce management application for small businesses.

Target businesses include:

- Restaurants
- Clinics
- Retail stores
- Small service businesses

Rota helps Owners, Managers, and Staff manage:

- Business teams
- Staff schedules
- Shift assignments
- Staff availability
- Shift swaps
- Notifications
- Subscription billing

The application supports:

- iOS
- Android

The current implementation target is **Phase 1: MVP**.

Build only the MVP unless the user explicitly asks for a later-phase feature.

The PRD is the product source of truth:

`Rota_Product_Requirements_Document.md`

The PRD defines what Rota must do.

This file defines how the coding agent must build it.

### Source-of-Truth Rules

1. Treat the PRD as the product source of truth.
2. Treat this `AGENTS.md` as the engineering and implementation rulebook.
3. When this file gives an implementation rule, follow this file.
4. When the PRD defines a product rule, preserve that rule.
5. Do not silently change product behaviour to make implementation easier.
6. Do not add features because they seem useful.
7. Do not build Phase 2 or Phase 3 features during MVP work.

---

# 2. What Is Locked?

The following choices are locked.

Do not replace, swap, remove, or "improve" them without explicit user approval.

## 2.1 Mobile Stack

Use:

- React Native
- Expo
- TypeScript

Do not replace React Native with Flutter, native Swift, Kotlin, or another mobile framework.

Do not replace Expo with another mobile runtime unless explicitly instructed.

Use TypeScript for application code.

Do not introduce JavaScript-only application modules unless required by a third-party package.

## 2.2 Backend Stack

Use a backend architecture that can be controlled:

- Node.js
- Express
- TypeScript

Do not replace Express with another backend framework.

Do not use vendor-locked BaaS solutions (e.g. Firebase, Supabase) for business logic.

Do not move business logic into the mobile application.

The backend owns the application's business rules and data mutations.

## 2.3 Database

Use:

- PostgreSQL
- Prisma ORM

PostgreSQL is the source of truth for persistent application data.

Prisma is the required database access layer.

Do not replace PostgreSQL with MongoDB, MySQL, SQLite, Firebase, Supabase, or another database.

Do not bypass Prisma with a second database access layer.

## 2.4 In-Memory Cache, Rate Limiting & Distributed Locks

Use:

- Redis
- A hosted free tier such as Upstash is fine and fully supported.

Redis is locked for:

- Rate limiting (protecting authentication, checkout, and API abuse).
- In-memory volatile caching (schedule reads, user sessions).
- Distributed locks (preventing race conditions during shift swap approvals, schedule publishing, and subscription seat updates).

Do not implement in-memory single-node stateful hacks that fail in distributed or multi-instance environments.

## 2.5 Background Job Queue

Use:

- BullMQ (runs on Redis)

BullMQ is locked for:

- Background job queueing and asynchronous worker processing.
- Push notification fan-out.
- Transactional email delivery.
- Asynchronous Flutterwave webhook event ingestion and retries.
- Scheduled background tasks (e.g., auto-completing expired shifts).

Do not execute slow or external I/O tasks synchronously inside HTTP request-response cycles.

## 2.6 API

Use a REST API.

The mobile application communicates with the backend through HTTPS REST endpoints.

Do not introduce GraphQL, tRPC, or another API architecture unless explicitly approved.

## 2.7 Payment Provider

**Flutterwave is the locked payment provider.**

Use Flutterwave for:

- Subscription checkout
- Payment processing
- Payment verification
- Payment webhooks
- Payment status handling
- Subscription billing events

Do not replace Flutterwave with Stripe, Paystack, Paddle, Lemon Squeezy, PayPal, or another provider.

Do not create a fake internal payment system.

Do not mark a payment successful based only on a mobile client response.

The backend must verify Flutterwave payment events before changing billing state (using Flutterwave's transaction verification API).

Flutterwave webhook processing must verify the `verif-hash` secret header matching the environment secret.

Flutterwave webhook processing must be idempotent.

Record the Flutterwave transaction reference or ID needed to prevent duplicate processing.

## 2.8 Database Model

Use the PRD data model as the required starting architecture.

The core entities are:

- User
- Business
- Membership
- Invitation
- Department
- Location
- Shift
- ShiftAssignment
- StaffAvailability
- StaffPreference
- SwapRequest
- Notification
- Subscription
- Payment
- AuditLog

Preserve the relationships and responsibilities defined by the PRD.

Do not remove a core entity simply because the first implementation does not appear to need it.

Do not replace relational relationships with unstructured JSON when a proper relation exists.

Provider-specific Flutterwave fields may be added where required to correctly support Flutterwave references and webhook reconciliation.

Do not redesign the database architecture without explicit approval.

## 2.9 Required Enums

Preserve these domain states unless the PRD is explicitly changed:

### MembershipRole

- OWNER
- MANAGER
- STAFF

### MembershipStatus

- INVITED
- ACTIVE
- SUSPENDED
- REMOVED

### ShiftStatus

- DRAFT
- PUBLISHED
- CANCELLED
- COMPLETED

### SwapStatus

- PENDING
- ACCEPTED
- APPROVED
- REJECTED
- CANCELLED
- EXPIRED

### SubscriptionStatus

- TRIALING
- ACTIVE
- PAST_DUE
- CANCELLED
- EXPIRED

### PaymentStatus

- PENDING
- SUCCESS
- FAILED
- REFUNDED

Do not invent alternative status systems for the same domain concepts.

## 2.10 Time Handling

Store timestamps in UTC.

Store the business timezone separately.

Use IANA timezone identifiers.

Examples:

- `Africa/Lagos`
- `Europe/London`
- `America/New_York`

Do not store business scheduling logic using local time strings alone.

Do not compare overnight shifts using time strings only.

Use complete timestamps when validating shift ranges.

## 2.11 Money Handling

Store monetary amounts in the smallest supported currency unit as whole numbers.

For example, store kobo rather than naira when working with NGN.

Never use floating-point numbers for money.

Never use JavaScript floating-point arithmetic for financial calculations.

Keep currency explicit on payment records.

---

# 3. What Must Never Happen?

Breaking any rule in this section means the task failed, even if the application builds and appears to work.

## 3.1 Authorization Rules

### AUTHZ-001

Enforce authorization on the backend.

Never rely on mobile UI checks to enforce permissions.

### AUTHZ-002

For every protected request, the backend must:

1. Authenticate the user.
2. Resolve the user's business membership.
3. Verify the user's role.
4. Verify ownership of the requested resource.
5. Apply the relevant business rule.
6. Perform the operation.

### AUTHZ-003

Never allow a user to access another business's data by changing a `businessId`, `memberId`, `shiftId`, or similar identifier.

### AUTHZ-004

Never trust role values supplied by the client.

The backend must determine the user's real role from trusted server-side data.

### AUTHZ-005

Never allow Staff to:

- Create shifts.
- Edit assigned shifts.
- Publish schedules.
- Approve swaps.
- Manage team members.
- Manage billing.

Reference: PRD Sections 4 and 5.

### AUTHZ-006

Never allow Managers to:

- Manage billing.
- Transfer ownership.
- Promote themselves to Owner.

Managers must not create other Managers unless the Owner has explicitly granted that permission.

Reference: PRD Section 4.2.

### AUTHZ-007

Only Owners may:

- Manage billing.
- Manage Manager access.
- Change business details.
- Manage ownership-level controls.

The Owner cannot transfer ownership in MVP.

Reference: PRD Sections 4.1 and 5.

---

## 3.2 Authentication Rules

### AUTH-001

Validate registration input on the backend.

### AUTH-002

Require email verification for actions that require a verified account.

### AUTH-003

Never store plain-text passwords.

Store passwords using a modern password hashing algorithm.

### AUTH-004

Password reset tokens must expire.

### AUTH-005

Securely manage authenticated sessions.

Support logout and session revocation or expiry.

Reference: PRD Section 7.1.

---

## 3.3 Business and Membership Rules

### TEAM-001

When a user creates a business, that user becomes the Owner.

### TEAM-002

A user may belong to multiple businesses.

Always resolve the active business membership before performing business-scoped operations.

### TEAM-003

Only active memberships may be used for normal business operations.

### TEAM-004

Prevent duplicate active invitations for the same user and business.

Do not create unlimited duplicate active invitations.

Reference: PRD TEAM-004 and Section 19.

### TEAM-005

Do not silently delete historical assignments when a Staff member is removed.

Future assignments must be handled explicitly.

The default behaviour is to mark the membership inactive and flag future assignments for Manager review.

Reference: PRD Section 19.

---

## 3.4 Scheduling Rules

### SHIFT-001

Only `DRAFT` and `PUBLISHED` shifts may be edited.

### SHIFT-002

A `CANCELLED` shift must not be restored through normal editing.

Reference: PRD Section 8.2.

### SHIFT-003

Reject invalid shift times.

### SHIFT-004

Reject zero-length shifts.

### SHIFT-005

Allow overnight shifts.

Use full timestamps to determine the actual start and end.

### SHIFT-006

Detect overlapping assignments.

Do not allow a Staff member to have conflicting shifts.

### SHIFT-007

Do not assign shifts to inactive Staff.

### SHIFT-008

Detect unavailable Staff during scheduling.

An unavailable period is a blocking scheduling rule unless a Manager or Owner explicitly overrides it.

### SHIFT-009

Preferences are advisory.

Do not treat preferences as hard blocks.

### SHIFT-010

When a Manager or Owner overrides an unavailable period, record the override in the audit log.

Reference: PRD Sections 8 and 10.

---

## 3.5 Schedule Publishing Rules

### PUBLISH-001

Staff must never see draft schedules.

### PUBLISH-002

Before publishing a schedule:

1. Validate the schedule.
2. Check conflicts.
3. Change eligible shifts to `PUBLISHED`.
4. Create notification events.
5. Notify affected Staff.

### PUBLISH-003

Schedule publishing must not partially succeed.

Use a database transaction where multiple related records must change together.

Reference: PRD Section 8.5.

---

## 3.6 Shift Swap Rules

### SWAP-001

A Staff member cannot request a swap when:

- The shift has already started.
- The shift is cancelled.
- The Staff member is no longer active.
- Another pending swap exists for the same assignment.

### SWAP-002

A receiving Staff member must:

- Belong to the same business.
- Be active.
- Have no overlapping shift.
- Not be unavailable.
- Not violate configured working limits.

### SWAP-003

A swap is never final until a Manager or Owner approves it.

### SWAP-004

Swap approval must acquire a Redis distributed lock for the swap and affected shift assignment, and run inside a backend transaction.

The approval workflow must:

1. Acquire Redis distributed lock for the swap ID.
2. Recheck the original assignment in the database.
3. Recheck the receiving Staff member status and eligibility.
4. Recheck scheduling conflicts.
5. Update the assignment.
6. Update the swap status to APPROVED.
7. Create audit records.
8. Enqueue user notifications into BullMQ for asynchronous dispatch.
9. Release the Redis distributed lock.

### SWAP-005

If any approval check fails, do not partially update the data.

### SWAP-006

Only the first valid approval may succeed.

A duplicate approval request must return the current swap state rather than applying the change twice.

Reference: PRD Sections 9 and 19.

---

## 3.7 Billing Rules

### BILL-001

Rota uses a monthly subscription model based on active seats.

### BILL-002

The default billable seat calculation is:

- Owner = 1 seat.
- Manager = 1 seat.
- Active Staff = 1 seat.
- Inactive members = 0 seats.

### BILL-003

Keep seat calculations deterministic.

Never use AI to calculate billable seats.

### BILL-004

Use Flutterwave for payment processing.

### BILL-005

Never trust the mobile client to confirm payment success.

### BILL-006

Only verified Flutterwave events or server-side Flutterwave verification may change payment state.

### BILL-007

Payment webhook processing must be idempotent.

Processing the same Flutterwave webhook twice must not:

- Create duplicate payments.
- Extend a subscription twice.
- Increase seat counts twice.
- Trigger duplicate billing effects.

### BILL-008

Record the provider reference required to identify a Flutterwave payment or event uniquely.

### BILL-009

Use database transactions for payment state changes that modify multiple records.

### BILL-010

If payment fails:

1. Record the failure.
2. Notify the Owner.
3. Retry according to Flutterwave-supported payment rules.
4. Keep the subscription in the configured grace state while retries continue.
5. Change the account to read-only after the configured grace period if payment remains unsuccessful.

### BILL-011

Subscription cancellation takes effect at the end of the paid period.

### BILL-012

Never delete schedules or Staff data because a subscription expires.

### BILL-013

When a subscription expires:

- Existing data remains stored.
- Historical information remains accessible according to permissions.
- Schedule creation is disabled.
- Schedule editing is disabled.
- New invitations are disabled.
- Billing remains accessible to the Owner.

Reference: PRD Section 12.

---

## 3.8 Trial Rules

### BILL-014

Use the configured 14-day free trial.

### BILL-015

Do not require a payment method to start the trial unless the product requirements are explicitly changed.

Reference: PRD Section 12.3.

---

## 3.9 Notification Rules

### NOTIFY-001

Support:

- In-app notifications.
- Push notifications.
- Important email notifications.

### NOTIFY-002

Notify affected users about important schedule and swap changes.

### NOTIFY-003

Do not expose sensitive information to users who do not have permission to view it.

Reference: PRD Section 11.

---

## 3.10 Audit Rules

### AUDIT-001

Audit sensitive actions.

At minimum, audit:

- Role changes.
- Shift changes.
- Shift cancellation.
- Schedule publishing.
- Swap approval.
- Swap rejection.
- Billing changes.
- Member removal.
- Availability overrides.

### AUDIT-002

Do not silently mutate important business records without creating the required audit record.

Reference: PRD Section 18.5.

---

## 3.11 Data Integrity Rules

### DATA-001

PostgreSQL is the source of truth.

Do not treat cached mobile data as authoritative.

### DATA-002

Use database transactions when multiple related records must change together.

At minimum, use transactions for:

- Swap approval.
- Role changes.
- Seat updates.
- Schedule publishing.
- Payment state updates.

### DATA-003

Use idempotency for operations where duplicate requests can cause financial or business problems.

At minimum, consider:

- Payment operations.
- Invitation creation.
- Swap approval.
- Schedule publishing.

### DATA-004

Use optimistic concurrency or equivalent version checking for concurrent schedule edits.

Never allow one Manager to silently overwrite another Manager's newer changes.

Reference: PRD Sections 14 and 19.

---

## 3.12 Input Validation Rules

### VALIDATE-001

Validate all external input on the backend.

Never trust:

- Mobile client validation.
- AI output.
- Payment callbacks.
- User-supplied role values.
- User-supplied business IDs.
- User-supplied resource IDs.

### VALIDATE-002

Validate AI output before using it.

Treat all AI output as untrusted input.

---

## 3.13 AI Rules

### AI-001

AI is not required for the MVP.

Do not introduce AI into deterministic core scheduling logic.

### AI-002

Never use AI to:

- Validate shifts.
- Approve swaps.
- Calculate billable seats.
- Enforce permissions.
- Process payments.
- Apply final scheduling changes.

### AI-003

Do not silently modify schedules using AI.

### AI-004

Future AI features must follow:

```text
User Request
    ↓
Input Validation
    ↓
AI Processing
    ↓
Structured Recommendation
    ↓
Business Rule Validation
    ↓
User Review
    ↓
User Approval
    ↓
Deterministic Backend Mutation
    ↓
Audit Log
    ↓
Notification
```

---

## 3.14 Redis, Caching, and Concurrency Rules

### REDIS-001

Use Redis for distributed locks on concurrency-critical mutations.

Acquire a Redis lock (with safe TTL and renewal/release mechanisms) before:

- Processing a shift swap approval.
- Publishing a business schedule week.
- Modifying subscription seat allocations.

### REDIS-002

Always release Redis locks in a `finally` block or ensure automatic lock expiration so deadlocks are impossible.

### REDIS-003

Enforce rate limiting via Redis on:

- Authentication routes (`/api/auth/*`).
- Subscription checkout initiation (`/api/businesses/:businessId/subscription/checkout`).
- Webhook endpoints.
- High-frequency polling or refresh endpoints.

### REDIS-004

Use Redis caching for read-heavy, low-churn queries (such as business settings, user role claims, and published schedules).

Always explicitly invalidate the relevant Redis cache keys upon mutation.

Hosted free-tier Redis providers (such as Upstash) are supported and acceptable.

---

## 3.15 Background Job Queue Rules

### QUEUE-001

Use BullMQ (running on Redis) for all asynchronous and background task execution.

### QUEUE-002

Never execute slow or network-bound operations synchronously inside HTTP request handlers:

- Push notification delivery (e.g., Expo push fan-out) must be enqueued via BullMQ.
- Email dispatch (invitations, shift alerts, password resets) must be enqueued via BullMQ.
- Flutterwave webhook reconciliation events must be handed off to BullMQ.
- Shift status transitions (marking past shifts completed) must run as scheduled BullMQ jobs.

### QUEUE-003

BullMQ jobs must be idempotent and configure exponential backoff retries.

Ensure that job failures are logged and do not corrupt persistent PostgreSQL state.