---
trigger: always_on
---

# Scheduling and Data Integrity Rules

## Purpose

Rota scheduling must remain deterministic, consistent, and safe.

The backend is authoritative for scheduling rules.

## Shift Creation

Before creating a shift, validate:

- Business access
- Creator authorization
- Start time
- End time
- Staff membership
- Shift status
- Location/department where applicable
- Availability
- Conflicts

Reject invalid or zero-length shifts.

## Overnight Shifts

Support overnight shifts.

Use complete UTC timestamps.

Do not assume the end time occurs on the same calendar date as the start time.

## Staff Conflicts

A staff member must not have overlapping assigned shifts.

Check conflicts on the backend.

Do not rely only on calendar UI validation.

## Membership

Do not assign a shift to:

- Removed staff
- Suspended staff
- Inactive memberships
- Members belonging to another business

## Availability

Treat unavailable periods as scheduling restrictions.

Block conflicting assignments by default.

If a Manager is allowed to override availability:

- Require explicit action.
- Warn about the conflict.
- Record the override in the audit log.

## Preferences

Staff preferences are guidance.

Do not treat preferences as hard restrictions unless the product explicitly defines them as such.

## Draft Schedules

Draft schedules are not visible to Staff.

Managers may work on drafts before publication.

## Publishing

Before publishing:

1. Verify authorization.
2. Validate all relevant shifts.
3. Check conflicts.
4. Check required assignments.
5. Persist the publication consistently.
6. Create required audit records.
7. Notify affected users after successful publication.

Publishing must not partially succeed.

## Published Changes

When a published shift changes:

- Validate the change.
- Re-check conflicts.
- Re-check affected assignments.
- Persist the change safely.
- Notify affected staff.

## Concurrent Editing

Do not silently overwrite a newer schedule change.

Use optimistic concurrency or another explicit conflict-detection mechanism.

If the schedule changed after the user loaded it, reject or require the user to refresh/reconcile.

## Cancellation

Cancelled shifts must be represented explicitly.

Do not treat cancellation as deletion when historical schedule information must remain available.

Do not silently restore cancelled shifts through ordinary editing.

## Shift Swaps

Swap approval must re-check current scheduling conditions.

Before approval verify:

- Shift still exists
- Shift has not started
- Shift is not cancelled
- Request is still pending
- Target remains active
- Target belongs to the same business
- Target has no conflict
- Target is available
- Applicable work-hour limits are satisfied

## Swap Transaction

Swap approval must update all required state consistently.

A successful approval should atomically handle:

- Assignment change
- Swap status
- Audit record
- Required notification state

Do not allow partial approval.

## Duplicate Operations

Repeated approval of the same swap must not produce multiple assignment changes.

Only the first valid approval changes the assignment.

Repeated requests must return the current state safely.

## Transactions

Use database transactions for operations involving multiple related scheduling records.

## Data Integrity

PostgreSQL is the source of truth.

Do not maintain a second authoritative schedule state in the mobile application.

Cached mobile data must never override server state.

## Offline Behaviour

The mobile application may display cached schedule data.

Mutations require connectivity.

Clearly indicate stale data.

Never show an offline mutation as confirmed until the backend accepts it.

## Timezone Changes

A business timezone change must not silently move existing shifts.

Existing shift timestamps remain authoritative.

## Notifications

Send schedule notifications only after the corresponding authoritative operation succeeds.

Do not notify Staff about a change that failed to persist.

## Testing

Scheduling changes must test:

- Overlapping shifts
- Overnight shifts
- Invalid times
- Inactive staff
- Availability conflicts
- Availability overrides
- Draft visibility
- Publishing
- Published edits
- Cancellation
- Concurrent edits
- Swap eligibility
- Duplicate swap approval
- Offline/stale schedule behaviour

## Failure Rule

If the system allows an invalid schedule, cross-business assignment, duplicate assignment change, or silent data overwrite, the implementation is considered failed even if the UI appears to work.