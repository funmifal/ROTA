---
trigger: always_on
---

# Database Schema Rules

## Purpose

PostgreSQL is the authoritative source of truth for Rota.

Prisma is the required ORM.

Database rules must protect data integrity even when clients or application code behave incorrectly.

## Schema Changes

- Every schema change must be represented by a Prisma migration.
- Do not manually change production schema without a migration.
- Do not modify existing migrations that may already have been applied.
- Create a new migration for subsequent changes.

## Relationships

Use database relationships and foreign keys to protect required relationships.

Core entities include:

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

## Uniqueness

Use database uniqueness constraints for business rules that require uniqueness.

Examples:

- User email
- Membership per user/business
- Department name within a business
- Location name within a business
- Shift assignment per shift/membership
- Business subscription
- Provider payment reference
- Invitation token

Do not rely only on application-level checks for uniqueness.

## Business Isolation

Business-owned records must be associated with the correct business.

Queries involving business-owned data must scope access to the authenticated user's business membership.

Never use a user-controlled ID alone to retrieve or modify another business's data.

## Soft Deletion and History

Where the product requires historical records, do not physically delete records merely because a membership becomes inactive.

Do not silently delete historical shift assignments.

Preserve schedule history required by the product.

## Money

Store monetary values as integer minor units.

Example:

```text
NGN 5,000 → 500000 kobo