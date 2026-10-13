# Rota Product Requirements Document

## 1. Product Summary

### Product Name

Rota

### Product Type

Mobile shift scheduling and workforce management application.

### Target Customers

Small businesses with hourly or shift-based workers, especially:

- Restaurants
- Clinics
- Retail stores
- Small service businesses

### Core Value Proposition

Rota helps small businesses create, publish, and manage staff schedules from one place.

Owners manage the business and subscription.

Managers manage shifts and approve swaps.

Staff view their schedules, manage availability, and request swaps.

### Platforms

- iOS
- Android

### Core Technology

- **Mobile Client**: React Native with Expo (TypeScript)
- **Backend**: Node.js (Express) with TypeScript — a controlled backend architecture
- **Database**: PostgreSQL with Prisma ORM
- **Cache, Rate Limiting & Locks**: Redis (a hosted free tier such as Upstash is supported and acceptable)
- **Background Job Queue**: BullMQ (runs on Redis)
- **Payment Provider**: Flutterwave
- **API Architecture**: HTTPS REST API

## 2. Problem Statement

Small businesses often manage staff schedules through spreadsheets, WhatsApp messages, paper schedules, or informal conversations.

This creates several problems:

- Staff may miss schedule changes.
- Managers spend time creating schedules manually.
- Shift conflicts are easy to miss.
- Staff cannot easily communicate shift swaps.
- Managers have limited visibility into who is available.
- Schedule changes can get lost in chat messages.
- Business owners lack a central view of their workforce.
- Billing based on team size is difficult to manage without clear seat tracking.

Rota provides one system for scheduling, shift swaps, availability, notifications, team management, and subscription billing.

## 3. Goals and Non-Goals

### Goals

Rota must:

1. Allow an Owner to create and manage a business team.
2. Allow Owners and Managers to create schedules.
3. Allow Managers to publish schedules.
4. Allow Staff to view their assigned shifts.
5. Detect scheduling conflicts.
6. Allow Staff to request shift swaps.
7. Require Manager approval before swaps become final.
8. Allow Staff to define availability and preferences.
9. Notify users about important schedule changes.
10. Track active billable seats.
11. Provide a subscription workflow.
12. Protect business data through role-based authorization.
13. Maintain an audit trail for important actions.

### Non-Goals

The MVP will not include:

- Payroll processing
- Employee salary management
- Attendance clock-in and clock-out
- Full HR management
- Recruitment
- Performance reviews
- Employee benefits management
- Bank account integration
- Calendar synchronization
- Social login
- Advanced AI schedule generation
- Complex labour-law compliance automation
- Full desktop administration portal

## 4. User Personas

### 4.1 Owner

The Owner owns the business account.

#### Goals

- Set up the business.
- Manage team members.
- Control roles.
- Monitor schedules.
- Manage billing.
- Maintain control of business data.

#### Permissions

The Owner can:

- Create and edit business details.
- Invite users.
- Remove users.
- Assign Manager roles.
- Change Staff roles.
- Create and edit shifts.
- Publish schedules.
- Approve or reject swaps.
- View audit records.
- Manage subscription and billing.
- Cancel the subscription.
- View business-level information.

The Owner cannot transfer ownership in MVP.

### 4.2 Manager

The Manager manages day-to-day scheduling.

#### Goals

- Build schedules.
- Assign Staff.
- Resolve conflicts.
- Approve swaps.
- Keep Staff informed.

#### Permissions

Managers can:

- View the team.
- Invite Staff.
- Create shifts.
- Edit shifts.
- Delete shifts.
- Publish schedules.
- View Staff availability.
- Approve swaps.
- Reject swaps.
- Initiate swaps.
- View relevant schedule history.

Managers cannot:

- Manage billing.
- Change business ownership.
- Promote themselves to Owner.
- Create another Manager unless the Owner grants that permission.

### 4.3 Staff

Staff use Rota to understand and manage their schedule.

#### Goals

- Know when they work.
- Know where they work.
- Communicate availability.
- Request swaps.
- Receive schedule updates.

#### Permissions

Staff can:

- View their shifts.
- View relevant shift information.
- Set availability.
- Set work preferences.
- Request swaps.
- Accept eligible swap requests.
- Cancel pending swap requests.
- Receive notifications.

Staff cannot:

- Create shifts.
- Edit assigned shifts.
- Publish schedules.
- Approve swaps.
- Manage team members.
- Manage billing.

## 5. User Roles and Permissions

| Action | Owner | Manager | Staff |
|---|---:|---:|---:|
| View business | Yes | Yes | Limited |
| Edit business | Yes | No | No |
| Manage billing | Yes | No | No |
| Invite Staff | Yes | Yes | No |
| Invite Manager | Yes | No | No |
| Remove Staff | Yes | Yes | No |
| Manage Manager access | Yes | No | No |
| Create shifts | Yes | Yes | No |
| Edit shifts | Yes | Yes | No |
| Delete shifts | Yes | Yes | No |
| Publish schedule | Yes | Yes | No |
| View own shifts | Yes | Yes | Yes |
| View team schedule | Yes | Yes | Limited |
| Set availability | Yes | Yes | Yes |
| Set preferences | Yes | Yes | Yes |
| Request swap | Yes | Yes | Yes |
| Approve swap | Yes | Yes | No |
| Reject swap | Yes | Yes | No |
| View audit records | Yes | Limited | No |

Authorization must be enforced on the backend.

The mobile application must not be trusted to enforce permissions by itself.

## 6. Core User Journeys

### 6.1 Owner Creates Business

1. User creates an account.
2. User verifies their email.
3. User creates a business.
4. User enters business name.
5. User selects industry.
6. User selects country.
7. User selects business timezone.
8. Rota creates the business.
9. User becomes the Owner.
10. Rota displays the business dashboard.

### 6.2 Owner Invites Staff

1. Owner opens Team.
2. Owner selects Invite Staff.
3. Owner enters email or phone.
4. Rota validates the invitation.
5. Rota creates an invitation.
6. Rota sends the invitation.
7. Invitee opens the invitation.
8. Invitee signs in or creates an account.
9. Rota creates the membership.
10. Staff appears as an active team member.

### 6.3 Manager Creates a Schedule

1. Manager opens Schedule.
2. Manager selects a date or schedule period.
3. Manager creates a shift.
4. Manager selects the time.
5. Manager selects a role.
6. Manager selects a location or department.
7. Manager assigns Staff.
8. Rota validates conflicts.
9. Manager saves the shift.
10. Manager repeats for other shifts.
11. Manager reviews the schedule.
12. Manager publishes it.
13. Assigned Staff receive notifications.

### 6.4 Staff Views Schedule

1. Staff opens Rota.
2. Rota loads the current schedule.
3. Staff sees upcoming assigned shifts.
4. Staff opens a shift.
5. Rota shows date, time, role, location, department, and notes.
6. Staff can request a swap if eligible.

### 6.5 Staff Requests Swap

1. Staff opens an assigned shift.
2. Staff selects Request Swap.
3. Rota checks whether the shift is eligible.
4. Staff selects an eligible colleague or creates an available swap request.
5. Rota creates a pending swap.
6. The other Staff member receives a notification.
7. The other Staff member accepts.
8. Rota checks the swap again.
9. Manager receives an approval request.
10. Manager approves or rejects.
11. Rota updates the assignment if approved.
12. Affected Staff receive notifications.

## 7. Functional Requirements

### 7.1 Authentication

#### AUTH-001 Account Creation

Users must be able to create an account with:

- Name
- Email
- Password

The system must validate the input.

#### AUTH-002 Email Verification

The system must send a verification mechanism after registration.

Unverified users cannot perform actions that require a verified account.

#### AUTH-003 Login

Users must be able to log in with email and password.

#### AUTH-004 Password Reset

Users must be able to request a password reset.

Reset tokens must expire.

#### AUTH-005 Session Management

Authenticated sessions must be securely managed.

Users must be able to log out.

### 7.2 Business Management

#### TEAM-001 Create Business

An authenticated user can create a business.

The user becomes the Owner.

#### TEAM-002 Business Details

The Owner can update:

- Business name
- Industry
- Country
- Timezone
- Default working settings

#### TEAM-003 Team Members

Owners and Managers can view the team.

Owners can manage roles.

#### TEAM-004 Invitations

Owners and Managers can invite Staff.

The system must prevent duplicate active invitations for the same user and business.

## 8. Scheduling Rules and Business Logic

### 8.1 Shift Fields

Each shift must support:

- ID
- Business ID
- Department ID
- Location ID
- Assigned Staff
- Date
- Start time
- End time
- Role
- Notes
- Status
- Created by
- Created timestamp
- Updated timestamp

### 8.2 Shift Status

Use:

- DRAFT
- PUBLISHED
- CANCELLED
- COMPLETED

Only DRAFT and PUBLISHED shifts can be edited.

A CANCELLED shift cannot be restored through normal editing.

### 8.3 Shift Validation

The system must:

- Reject invalid times.
- Reject zero-length shifts.
- Allow overnight shifts.
- Detect overlapping assignments.
- Detect unavailable Staff.
- Warn about preference conflicts.
- Prevent assignments to inactive Staff.

### 8.4 Recurring Shifts

Managers can create recurring shifts.

The system must allow:

- Start date
- End date
- Days of week
- Start time
- End time
- Assigned Staff
- Role
- Location
- Department

The system must validate generated shifts before publishing.

### 8.5 Schedule Publishing

Managers can prepare schedules as drafts.

Staff cannot see draft schedules.

When published:

1. Rota validates the schedule.
2. Rota checks conflicts.
3. Rota changes eligible shifts to PUBLISHED.
4. Rota creates notification events.
5. Staff receive notifications.

## 9. Shift Swap Rules

### 9.1 Swap States

Use:

- PENDING
- ACCEPTED
- APPROVED
- REJECTED
- CANCELLED
- EXPIRED

### 9.2 Swap Requirements

A Staff member cannot request a swap if:

- The shift has already started.
- The shift is cancelled.
- The Staff member is no longer active.
- Another pending swap already exists for the same assignment.

### 9.3 Eligibility

The receiving Staff member must:

- Belong to the same business.
- Be active.
- Not have an overlapping shift.
- Not be unavailable.
- Not violate configured working limits.

### 9.4 Manager Approval

A swap is not final until a Manager or Owner approves it.

Approval must happen through a backend transaction.

The transaction must:

1. Recheck the original assignment.
2. Recheck the receiving Staff member.
3. Recheck conflicts.
4. Update the assignment.
5. Update the swap status.
6. Create audit records.
7. Create notifications.

If any check fails, the transaction must fail without partially updating the data.

## 10. Staff Availability and Preferences

### 10.1 Availability

Staff can define:

- Available days
- Unavailable days
- Available time ranges
- Unavailable time ranges
- Recurring availability
- One-off availability

### 10.2 Preferences

Staff can define:

- Preferred shift type
- Preferred working days
- Preferred weekly hours
- Preferred departments where applicable

### 10.3 Scheduling Behaviour

Preferences guide Managers.

They do not automatically block scheduling.

Unavailable periods should produce a blocking validation unless a Manager or Owner explicitly overrides the rule.

An override must be recorded in the audit log.

## 11. Notifications

### 11.1 Notification Channels

Rota supports:

- In-app notifications
- Push notifications
- Email notifications

### 11.2 Notification Events

| Event | Staff | Manager | Owner |
|---|---:|---:|---:|
| New shift | Yes | Optional | Optional |
| Shift changed | Yes | Yes | Yes |
| Shift cancelled | Yes | Yes | Yes |
| Swap requested | Relevant | Yes | Yes |
| Swap accepted | Relevant | Yes | Yes |
| Swap approved | Yes | Yes | Yes |
| Swap rejected | Yes | Yes | Yes |
| Invitation | Yes | Yes | Yes |
| Payment failure | No | No | Yes |
| Subscription expiry | No | No | Yes |

Notifications must not expose sensitive information to users without permission.

## 12. Subscription and Billing

### 12.1 Pricing Model

Rota uses a monthly per-seat subscription.

The exact price per seat is an open business decision.

### 12.2 Billable Seats

The default rule is:

- Owner counts as one seat.
- Each Manager counts as one seat.
- Each active Staff member counts as one seat.
- Inactive members do not count.

### 12.3 Free Trial

The default trial is 14 days.

No payment method is required to start the trial.

### 12.4 Adding Seats

When the Owner adds a user:

1. Rota checks the current subscription.
2. Rota checks seat availability.
3. Rota updates the subscription quantity.
4. Rota records the billing event.
5. The user becomes active if all other requirements pass.

### 12.5 Removing Seats

Removing a user reduces the active seat count.

The subscription reduction applies at the next billing period unless Flutterwave supports immediate plan adjustment.

### 12.6 Failed Payment

If payment fails:

1. Rota records the failure.
2. Rota notifies the Owner.
3. Rota retries based on Flutterwave retry rules and webhooks.
4. Rota keeps the subscription in a grace state while retries continue.
5. Rota changes the account to read-only if payment remains unsuccessful after the configured grace period.

### 12.7 Cancellation

The Owner can cancel the subscription.

Cancellation takes effect at the end of the paid period.

Future schedules remain stored.

### 12.8 Expired Subscription

When the subscription expires:

- Existing data remains accessible.
- Staff can view historical information according to access rules.
- Schedule creation and editing are disabled.
- New invitations are disabled.
- Billing remains accessible to the Owner.

### 12.9 Flutterwave Payment Integration

Flutterwave is the locked payment provider for Rota.

1. **Checkout Flow**:
   - The backend initiates subscription checkout sessions with Flutterwave Standard or Inline checkout.
   - Flutterwave returns a secure payment link or transaction reference.
   - The mobile application opens the Flutterwave checkout interface.
2. **Server-Side Verification**:
   - Rota NEVER trusts the mobile client to confirm payment success.
   - The backend explicitly queries Flutterwave's transaction verification API (`GET https://api.flutterwave.com/v3/transactions/:id/verify`) before activating or renewing subscriptions.
3. **Webhook Processing**:
   - Flutterwave webhook notifications (`POST /api/billing/flutterwave/webhook`) must verify the `verif-hash` secret header configured in the Flutterwave dashboard.
   - Webhook processing must be idempotent: store the Flutterwave transaction reference/ID and ensure duplicate events cannot result in duplicate credits, seat increases, or multiple charges.
   - Webhooks are handed off to a BullMQ background queue to return an immediate 200 OK to Flutterwave and ensure reliable asynchronous processing.

## 13. AI Processing Pipeline

### 13.1 MVP Decision

AI is not required for the core Rota MVP.

Scheduling rules must remain deterministic.

The system must not depend on an AI model to:

- Validate shifts.
- Approve swaps.
- Calculate billable seats.
- Enforce permissions.
- Process payments.
- Apply final scheduling changes.

### 13.2 Future AI Use Cases

Potential future capabilities include:

- Schedule suggestions.
- Staff recommendations.
- Conflict explanations.
- Schedule summaries.
- Natural-language schedule queries.

### 13.3 AI Safety Rule

AI suggestions must never silently modify schedules.

The pipeline should follow:

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

AI output must be treated as untrusted input.

The backend must validate AI output before using it.

## 14. Technical Requirements

### 14.1 Mobile

Use:

- React Native
- Expo
- TypeScript

Suggested structure:

```text
src/
  features/
    auth/
    business/
    team/
    schedule/
    swaps/
    availability/
    notifications/
    billing/
  components/
  navigation/
  services/
  state/
  utils/
  types/
```

### 14.2 Backend

Use:

- Node.js
- Express
- TypeScript

Suggested structure:

```text
src/
  modules/
    auth/
    businesses/
    memberships/
    shifts/
    swaps/
    availability/
    notifications/
    billing/
  middleware/
  services/
  jobs/
  utils/
  config/
  database/
```

The backend must control:

- Authentication
- Authorization
- Validation
- Business rules
- Billing state
- Schedule mutations
- Swap approval
- Audit logging

### 14.3 Database

Use:

- PostgreSQL
- Prisma ORM

The database must enforce important integrity rules where practical.

### 14.4 Validation

Validate all external input on the backend.

Do not trust:

- Mobile client validation.
- AI output.
- Payment callbacks.
- User-supplied role values.
- User-supplied business IDs.

### 14.5 Transactions

Use database transactions for operations that modify multiple related records.

Examples:

- Swap approval
- Role changes
- Seat updates
- Schedule publishing
- Payment state updates

### 14.6 Idempotency

Use idempotency for operations where duplicate requests could cause financial or business problems.

Important examples:

- Payment operations
- Invitation creation
- Swap approval
- Schedule publishing

### 14.7 Rate Limiting

Rate-limit:

- Login
- Password reset
- Invitations
- Sensitive mutation endpoints
- Payment endpoints

### 14.8 Timezones

Store timestamps in UTC.

Store the business timezone separately using an IANA timezone identifier.

Examples:

- Africa/Lagos
- Europe/London
- America/New_York

Convert times for display based on the relevant business timezone.

## 15. System Architecture

```text
       React Native + Expo Mobile App (iOS / Android)
                             |
                             | HTTPS REST API
                             ↓
           Node.js + Express (Controlled Backend)
           [Rate Limiting, Routing, Controller, Auth]
                 |                       |
                 | (Cache / Locks)       | (Enqueue Jobs)
                 ↓                       ↓
         Redis (Upstash / Hosted)   BullMQ Queue (Redis)
         - Volatile Caching              |
         - Rate Limiting                 | (Async Workers)
         - Distributed Locks             ↓
                 |             Background Job Workers
                 |             - Push Notification Fan-out
                 |             - Email Dispatch
                 |             - Flutterwave Webhook Processing
                 |             - Shift Publishing Automations
                 |                       |
                 ↓                       ↓
             Prisma ORM (Database Access Layer)
                             |
                             ↓
              PostgreSQL (Source of Truth)
                             |
              -------------------------------
              |                             |
      Push/Email Providers         Flutterwave Payments
      (Expo Push / Resend / SES)   (Checkout, Verification, Webhooks)
```

### Core Architectural Principles

1. **Client Role**: The mobile app (React Native + Expo) is strictly a presentation and interaction client.
2. **Controllable Backend**: Node.js with Express owns all business rules, authorization, and data mutation workflows. It is fully controlled without vendor-locked backend-as-a-service limitations.
3. **Source of Truth**: PostgreSQL is the single source of truth for all persistent application data.
4. **Data Access**: Prisma ORM handles all relational queries, migrations, and database transactions.
5. **In-Memory Operations**: Redis provides fast volatile caching, API rate limiting, and distributed locks. A hosted free tier such as Upstash is fully supported.
6. **Asynchronous Processing**: BullMQ (running on Redis) processes all background jobs (push notifications, emails, Flutterwave webhook reconciliation, scheduled jobs) to keep API responses instantaneous and resilient.
7. **Payment Integrity**: Flutterwave is the locked payment provider; payment state changes only upon verified server-side callbacks or explicit Flutterwave API verification.
8. **Audit Trail**: High-stakes mutations (billing, swaps, publishing, permissions) generate non-blocking audit log entries.

## 16. API Requirements

### Authentication

#### POST /api/auth/register

Creates a user account.

Authentication: None.

#### POST /api/auth/login

Authenticates a user.

Authentication: None.

#### POST /api/auth/logout

Ends the authenticated session.

Authentication: Required.

#### POST /api/auth/forgot-password

Starts password reset.

Authentication: None.

#### POST /api/auth/reset-password

Completes password reset.

Authentication: None with valid reset token.

### Businesses

#### POST /api/businesses

Creates a business.

Role: Authenticated user.

#### GET /api/businesses/:businessId

Returns business details.

Role: Business member.

#### PATCH /api/businesses/:businessId

Updates business details.

Role: Owner.

### Team

#### GET /api/businesses/:businessId/members

Returns business members.

Role: Owner or Manager.

#### POST /api/businesses/:businessId/invitations

Creates an invitation.

Role: Owner or Manager.

#### PATCH /api/businesses/:businessId/members/:memberId

Updates membership or role.

Role: Owner.

#### DELETE /api/businesses/:businessId/members/:memberId

Removes a member.

Role: Owner or permitted Manager.

### Shifts

#### GET /api/businesses/:businessId/shifts

Returns shifts based on filters.

Role: Business member.

#### POST /api/businesses/:businessId/shifts

Creates a shift.

Role: Owner or Manager.

#### PATCH /api/businesses/:businessId/shifts/:shiftId

Updates a shift.

Role: Owner or Manager.

#### DELETE /api/businesses/:businessId/shifts/:shiftId

Cancels or deletes a shift.

Role: Owner or Manager.

#### POST /api/businesses/:businessId/shifts/publish

Publishes draft shifts.

Role: Owner or Manager.

### Availability

#### GET /api/businesses/:businessId/availability

Returns availability according to permission.

#### PUT /api/businesses/:businessId/availability

Creates or updates Staff availability.

Role: Staff for their own availability.

### Swaps

#### POST /api/businesses/:businessId/swaps

Creates a swap request.

Role: Staff or Manager.

#### GET /api/businesses/:businessId/swaps

Lists relevant swap requests.

Role: Business member according to permissions.

#### POST /api/businesses/:businessId/swaps/:swapId/accept

Accepts a swap request.

Role: Eligible Staff.

#### POST /api/businesses/:businessId/swaps/:swapId/approve

Approves a swap.

Role: Owner or Manager.

#### POST /api/businesses/:businessId/swaps/:swapId/reject

Rejects a swap.

Role: Owner or Manager.

#### POST /api/businesses/:businessId/swaps/:swapId/cancel

Cancels a pending swap.

Role: Requesting Staff or Manager where applicable.

### Billing

#### GET /api/businesses/:businessId/subscription

Returns subscription status, tier, current seat counts, and payment history.

Role: Owner.

#### POST /api/businesses/:businessId/subscription/checkout

Initiates Flutterwave subscription checkout and returns the payment URL and transaction reference.

Role: Owner.

#### GET /api/billing/flutterwave/verify/:transactionId

Queries Flutterwave transaction verification API (`v3/transactions/:id/verify`) to confirm payment status directly from the server.

Role: Authenticated Owner or internal service.

#### POST /api/billing/flutterwave/webhook

Receives incoming event notifications from Flutterwave.

Authentication: Verified Flutterwave secret hash (`verif-hash` header matching environment secret). Enqueues event into BullMQ for idempotent background processing.

## 17. Prisma Data Model

The following model is the recommended starting point.

```prisma
enum MembershipRole {
  OWNER
  MANAGER
  STAFF
}

enum MembershipStatus {
  INVITED
  ACTIVE
  SUSPENDED
  REMOVED
}

enum ShiftStatus {
  DRAFT
  PUBLISHED
  CANCELLED
  COMPLETED
}

enum SwapStatus {
  PENDING
  ACCEPTED
  APPROVED
  REJECTED
  CANCELLED
  EXPIRED
}

enum NotificationType {
  SHIFT_CREATED
  SHIFT_UPDATED
  SHIFT_CANCELLED
  SWAP_REQUESTED
  SWAP_ACCEPTED
  SWAP_APPROVED
  SWAP_REJECTED
  INVITATION
  BILLING
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELLED
  EXPIRED
}

enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
  REFUNDED
}

model User {
  id              String   @id @default(cuid())
  name            String
  email           String   @unique
  passwordHash    String
  emailVerifiedAt DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  memberships     Membership[]
  invitations     Invitation[]
  shiftsCreated   Shift[]
  swapRequests    SwapRequest[] @relation("SwapRequester")
  notifications   Notification[]
  auditLogs       AuditLog[]
}

model Business {
  id           String   @id @default(cuid())
  name         String
  industry     String
  country      String
  timezone     String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  memberships  Membership[]
  invitations  Invitation[]
  departments  Department[]
  locations    Location[]
  shifts       Shift[]
  availability StaffAvailability[]
  preferences  StaffPreference[]
  swapRequests SwapRequest[]
  notifications Notification[]
  subscription Subscription?
  payments     Payment[]
  auditLogs    AuditLog[]
}

model Membership {
  id               String           @id @default(cuid())
  userId           String
  businessId       String
  role             MembershipRole
  status           MembershipStatus @default(ACTIVE)
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  user             User             @relation(fields: [userId], references: [id])
  business         Business         @relation(fields: [businessId], references: [id])
  shiftAssignments ShiftAssignment[]
  availability     StaffAvailability[]
  preferences      StaffPreference[]

  @@unique([userId, businessId])
  @@index([businessId, status])
}

model Invitation {
  id             String           @id @default(cuid())
  businessId     String
  invitedUserId  String?
  email          String?
  phone          String?
  role           MembershipRole
  tokenHash      String           @unique
  expiresAt      DateTime
  acceptedAt     DateTime?
  createdAt      DateTime         @default(now())

  business       Business         @relation(fields: [businessId], references: [id])
  invitedUser    User?            @relation(fields: [invitedUserId], references: [id])

  @@index([businessId, email])
}

model Department {
  id         String   @id @default(cuid())
  businessId String
  name       String
  createdAt  DateTime @default(now())

  business   Business @relation(fields: [businessId], references: [id])
  shifts     Shift[]

  @@unique([businessId, name])
}

model Location {
  id         String   @id @default(cuid())
  businessId String
  name       String
  address    String?
  createdAt  DateTime @default(now())

  business   Business @relation(fields: [businessId], references: [id])
  shifts     Shift[]

  @@unique([businessId, name])
}

model Shift {
  id           String      @id @default(cuid())
  businessId   String
  departmentId String?
  locationId   String?
  createdById  String
  roleName     String
  startAt      DateTime
  endAt        DateTime
  notes        String?
  status       ShiftStatus @default(DRAFT)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  business     Business    @relation(fields: [businessId], references: [id])
  department   Department? @relation(fields: [departmentId], references: [id])
  location     Location?   @relation(fields: [locationId], references: [id])
  createdBy    User        @relation(fields: [createdById], references: [id])
  assignments  ShiftAssignment[]
  swapRequests SwapRequest[]

  @@index([businessId, startAt])
  @@index([businessId, status])
}

model ShiftAssignment {
  id           String     @id @default(cuid())
  shiftId      String
  membershipId String
  createdAt    DateTime   @default(now())

  shift        Shift      @relation(fields: [shiftId], references: [id])
  membership   Membership @relation(fields: [membershipId], references: [id])

  @@unique([shiftId, membershipId])
  @@index([membershipId, shiftId])
}

model StaffAvailability {
  id           String      @id @default(cuid())
  businessId   String
  membershipId String
  dayOfWeek    Int?
  date         DateTime?
  startTime    String?
  endTime      String?
  available    Boolean
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  business     Business    @relation(fields: [businessId], references: [id])
  membership   Membership  @relation(fields: [membershipId], references: [id])

  @@index([membershipId, date])
}

model StaffPreference {
  id                 String      @id @default(cuid())
  businessId         String
  membershipId       String
  preferredShiftType String?
  maxWeeklyHours     Decimal?
  preferredDays      Json?
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt

  business           Business    @relation(fields: [businessId], references: [id])
  membership         Membership @relation(fields: [membershipId], references: [id])

  @@unique([membershipId])
}

model SwapRequest {
  id                 String     @id @default(cuid())
  businessId         String
  shiftId            String
  requesterId        String
  targetMembershipId String?
  status             SwapStatus @default(PENDING)
  rejectionReason    String?
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt
  approvedAt         DateTime?

  business           Business   @relation(fields: [businessId], references: [id])
  shift              Shift      @relation(fields: [shiftId], references: [id])
  requester          User       @relation("SwapRequester", fields: [requesterId], references: [id])

  @@index([businessId, status])
  @@index([shiftId, status])
}

model Notification {
  id         String           @id @default(cuid())
  userId     String
  businessId String
  type       NotificationType
  title      String
  body       String
  readAt     DateTime?
  createdAt  DateTime         @default(now())

  user       User             @relation(fields: [userId], references: [id])
  business   Business         @relation(fields: [businessId], references: [id])

  @@index([userId, readAt, createdAt])
}

model Subscription {
  id                     String             @id @default(cuid())
  businessId             String             @unique
  providerCustomerId     String?
  providerSubscriptionId String?
  status                 SubscriptionStatus
  seatCount              Int
  trialEndsAt            DateTime?
  currentPeriodStart     DateTime?
  currentPeriodEnd       DateTime?
  cancelledAt            DateTime?
  createdAt              DateTime           @default(now())
  updatedAt              DateTime           @updatedAt

  business               Business           @relation(fields: [businessId], references: [id])
  payments               Payment[]
}

model Payment {
  id                String        @id @default(cuid())
  businessId        String
  subscriptionId    String?
  provider          String        @default("FLUTTERWAVE")
  providerReference String        @unique
  flwTransactionId  String?       @unique
  amountMinor       Int
  currency          String        @default("NGN")
  status            PaymentStatus
  paidAt            DateTime?
  createdAt         DateTime      @default(now())

  business          Business      @relation(fields: [businessId], references: [id])
  subscription      Subscription? @relation(fields: [subscriptionId], references: [id])

  @@index([businessId, createdAt])
  @@index([providerReference])
  @@index([flwTransactionId])
}

model AuditLog {
  id          String   @id @default(cuid())
  businessId  String
  actorUserId String?
  action      String
  entityType  String
  entityId    String
  metadata    Json?
  createdAt   DateTime @default(now())

  business    Business @relation(fields: [businessId], references: [id])
  actor       User?    @relation(fields: [actorUserId], references: [id])

  @@index([businessId, createdAt])
  @@index([entityType, entityId])
}
```

Flutterwave is the locked payment provider; the schema maintains dedicated references for Flutterwave transaction verification and idempotency.

## 18. Security, Rate Limiting, and Concurrency

### 18.1 Authorization

Every protected API endpoint must:

1. Authenticate the user.
2. Resolve the business membership.
3. Verify the user's role.
4. Verify ownership of the requested resource.
5. Apply the business rule.
6. Perform the operation.

A user must never access another business's records by changing an ID in a request.

### 18.2 Password Security

Passwords must be hashed using a modern password hashing algorithm (e.g., Argon2 or bcrypt with high work factor).

Plain-text passwords must never be stored.

### 18.3 Session Security

Use secure session management.

Tokens or sessions must have appropriate expiry and revocation behaviour, with token revocation stored or validated against Redis.

### 18.4 Flutterwave Payment Webhooks

Flutterwave payment webhooks must:

- Verify the `verif-hash` secret header matching the configured webhook secret.
- Reject requests with missing or invalid hashes immediately with HTTP 401.
- Hand off verified webhook payloads to a BullMQ queue for idempotent asynchronous processing.
- Record the Flutterwave transaction reference/ID to guarantee idempotency.
- Never trust the mobile client to confirm payment.

### 18.5 Redis Rate Limiting & Abuse Prevention

The system uses Redis (hosted free tier such as Upstash is supported) for distributed rate limiting:

- **Authentication endpoints** (`/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`): Strict rate limiting per IP and per account to protect against credential stuffing and brute-force attacks.
- **Sensitive business endpoints** (checkout initiation, swap requests, invites): Token-bucket or sliding-window rate limiting.
- **Standard API routes**: Global client throttling to preserve backend availability.

### 18.6 Redis Distributed Locks & Concurrency Control

To guarantee data integrity across concurrent requests, Redis provides distributed locking (e.g., Redlock or key-based mutex locks with automatic TTL expiration):

- **Shift Swap Approvals**: Acquires a Redis lock on the affected shift and swap IDs during the approval transaction to prevent double approvals or overlapping shift assignments.
- **Schedule Publishing**: Acquires a Redis lock for the business scheduling week during publishing to prevent race conditions from simultaneous manager edits.
- **Seat Allocation**: Acquires a lock on the business subscription when adding billable seats.

### 18.7 BullMQ Background Processing

BullMQ (running on Redis) processes background workloads out-of-band:

- **Notifications & Push Delivery**: Fan-out of schedule notifications and shift reminders without blocking API response times.
- **Email Delivery**: Asynchronous transactional email dispatch.
- **Webhook Reconciliation**: Reliable retry mechanism with exponential backoff for Flutterwave event ingestion.
- **Shift Status Transitions**: Scheduled background workers transitioning completed shifts.

### 18.8 Audit Logging

Audit sensitive actions such as:

- Role changes
- Shift changes
- Shift cancellation
- Schedule publishing
- Swap approval
- Swap rejection
- Billing changes
- Member removal

## 19. Edge Cases and Failure Handling

### Duplicate Invitation

If an active invitation already exists, return the existing invitation state instead of creating unlimited duplicates.

### Removed Staff With Future Shifts

The system must not silently delete historical assignments.

Future assignments must be handled explicitly.

The default behaviour is to mark the membership inactive and flag future assignments for Manager review.

### Concurrent Shift Editing

The backend must prevent one Manager from silently overwriting another Manager's newer changes.

Use updated timestamps or version checks.

### Duplicate Swap Approval

Only the first valid approval should succeed.

Later duplicate approval attempts should return the current swap state.

### Payment Webhook Duplication

Processing the same webhook twice must not create two payments or extend the subscription twice.

### Offline Mobile Usage

Users may view recently cached schedule data.

Mutations require connectivity.

The application must clearly show stale data when offline.

### Timezone Changes

Changing the business timezone must not silently move existing shifts.

The system must clearly define how future schedules are interpreted before allowing timezone changes.

### Overnight Shifts

A shift may end on the following calendar day.

The backend must compare full timestamps rather than comparing time strings only.

### Subscription Expiry

Subscription expiry must not delete schedules or Staff data.

The business becomes restricted based on the subscription rules.

## 20. Business Model

### Revenue Model

Rota uses a monthly subscription.

The business pays based on active seats.

### Pricing

The exact price per seat is not confirmed.

**OPEN QUESTION:** What is the monthly price per seat?

### Target Customer

Small businesses with approximately 5 to 100 workers.

The product should remain simple enough for owners without dedicated HR or operations teams.

### Expansion Opportunities

Future revenue opportunities may include:

- Larger team plans
- Advanced reporting
- AI scheduling assistance
- Multiple-location management
- Advanced compliance tools
- Payroll integrations

These are not MVP requirements.

## 21. Success Metrics

### North-Star Metric

Percentage of active businesses that successfully publish and maintain a schedule each week.

### Activation Metrics

| Metric | Target |
|---|---|
| Business creates first team | To be established |
| Business invites 3+ Staff | To be established |
| Business publishes first schedule | To be established |

### Engagement Metrics

- Weekly active businesses.
- Weekly active Staff.
- Schedule views.
- Shifts viewed before start.
- Swap requests.
- Successful swap completion rate.

### Business Metrics

- Trial-to-paid conversion.
- Monthly recurring revenue.
- Average revenue per business.
- Monthly churn.
- Average seats per paying business.
- Customer retention.

### Quality Metrics

- Schedule publishing success rate.
- Notification delivery rate.
- API error rate.
- Mobile crash rate.
- Payment webhook success rate.
- Swap transaction failure rate.

Targets should be established after baseline usage data exists.

## 22. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Scheduling becomes too complex | High | Medium | Keep MVP focused on core scheduling |
| Managers do not adopt the tool | High | Medium | Make schedule creation fast |
| Staff ignore notifications | High | Medium | Use push notifications and clear reminders |
| Swap rules become confusing | Medium | Medium | Show eligibility and clear statuses |
| Billing disputes | High | Medium | Keep seat calculation transparent |
| Payment webhook failures | High | Medium | Use idempotency and reconciliation |
| Incorrect timezone handling | High | Medium | Store UTC plus IANA timezone |
| Unauthorized data access | Critical | Low | Backend RBAC and resource checks |
| Concurrent edits cause data loss | High | Medium | Optimistic concurrency checks |
| AI produces unsafe recommendations | High | Low | Keep AI advisory and validate all output |
| MVP becomes too large | High | High | Enforce phased roadmap |

## 23. Assumptions

### Confirmed Assumptions

- Rota is a mobile-first product.
- Rota supports iOS and Android.
- React Native with Expo is used.
- Node.js with Express is used for the backend.
- PostgreSQL is the database.
- Prisma is the ORM.
- REST is the API style.
- One Owner exists per business in v1.
- A user can belong to multiple businesses.
- Owners have full control.
- Managers manage schedules.
- Staff manage availability and swap requests.
- Businesses pay per active seat.
- Billing is monthly.
- A 14-day free trial is used.
- Draft schedules are supported.
- Published schedules can be changed.
- Staff cannot directly edit assigned shifts.
- Manager approval is required for swaps.
- Push, in-app, and important email notifications are supported.
- Core scheduling does not depend on AI.
- AI is advisory only if introduced.
- Calendar integration is excluded from MVP.
- Social login is excluded from MVP.
- MFA is excluded from MVP.

### ADDED ASSUMPTIONS

#### ADDED ASSUMPTION 1

The initial target customer size is approximately 5 to 100 workers.

This can be changed after customer research.

#### ADDED ASSUMPTION 2

The Owner counts as a billable seat.

#### ADDED ASSUMPTION 3

Managers count as billable seats.

#### ADDED ASSUMPTION 4

Basic offline schedule viewing is useful for mobile workers.

#### ADDED ASSUMPTION 5

Business timezone is the primary timezone for schedule calculations.

## 24. Phased Roadmap

### Phase 1: MVP

#### Authentication

- Registration
- Login
- Email verification
- Password reset
- Logout

#### Business

- Business creation
- Business profile
- Team management
- Invitations
- Roles

#### Scheduling

- Create shifts
- Edit shifts
- Delete or cancel shifts
- Draft schedules
- Publish schedules
- Recurring shifts
- Conflict detection
- Staff assignment
- Schedule viewing

#### Staff

- Availability
- Preferences
- Personal schedule

#### Swaps

- Create swap request
- Accept swap
- Approve swap
- Reject swap
- Cancel swap
- Eligibility validation

#### Notifications

- Push notifications
- In-app notifications
- Important email notifications

#### Billing

- Free trial
- Monthly subscription
- Seat tracking
- Payment processing
- Payment webhooks
- Cancellation
- Expiration handling

#### Security

- RBAC
- Audit logging
- Rate limiting
- Secure authentication
- Backend validation

### MVP Exit Criteria

The MVP is ready when:

1. An Owner can create a business.
2. An Owner can invite Staff.
3. A Manager can create a schedule.
4. Staff can view published shifts.
5. The system detects shift conflicts.
6. Staff can request swaps.
7. Managers can approve swaps.
8. Notifications are delivered for core events.
9. Billing can create and maintain a subscription.
10. Unauthorized users cannot access another business's data.
11. Core workflows pass automated tests.
12. Critical errors are logged and observable.

### Phase 2: Growth

Potential features:

- Multiple locations
- Advanced reporting
- Schedule templates
- Better recurring schedules
- Bulk schedule editing
- Improved analytics
- Advanced notification controls
- Calendar integrations
- Manager performance insights

These features should be prioritized using actual customer usage data.

### Phase 3: Advanced Capabilities

Potential features:

- AI schedule recommendations
- Natural-language schedule queries
- Intelligent staffing suggestions
- Labour-rule assistance
- Payroll integrations
- Advanced workforce analytics
- Enterprise permissions
- Advanced compliance features

AI features must remain advisory until the business has strong validation and safety controls.

## 25. Open Questions

### Business

1. What is the exact monthly price per seat?
2. Which countries will Rota support at launch?
3. Which currency will be used at launch?
4. **Which payment provider will Rota use?**
   - **RESOLVED**: Flutterwave is the locked payment provider for subscriptions, card checkout, server verification, and webhooks.
5. Should Owner and Manager accounts remain billable seats?

### Product

6. Should Staff see the complete team schedule or only their own shifts?
7. Should Staff be able to offer a shift to a specific colleague?
8. Should businesses be able to create departments and locations in MVP?
9. Should Rota support multiple locations from launch?
10. Should Managers be able to create other Managers?
11. Should automated schedule generation be added later?
12. What exact labour or working-hour rules should the system support?

### Technical

13. **Technical Stack Architecture**:
   - **RESOLVED & LOCKED**:
     - Mobile Frontend: React Native with Expo (TypeScript)
     - Controllable Backend: Node.js (Express) with PostgreSQL (Prisma ORM)
     - In-Memory & Caching: Redis for caching, rate limiting, and distributed locks (hosted free tier such as Upstash is supported and acceptable)
     - Asynchronous Job Queue: BullMQ (runs on Redis)
14. Which cloud provider should host the API?
15. Which push notification provider should be used? (e.g., Expo Application Services / Expo Push)
16. Which email provider should be used? (e.g., Resend, SendGrid, Amazon SES)
17. What data retention period is required?
18. Is MFA required for Owners in a later phase?
19. What analytics provider should be used?
