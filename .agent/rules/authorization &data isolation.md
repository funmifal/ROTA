---
trigger: always_on
---


---

# 9. `authorization &data isolation.md`

### Debate

**Builder/Engineer:**  
The most important thing is that authorization is enforced where the data is accessed, not merely hidden in the UI.

**Product Manager:**  
A cross-business data leak would be one of the most serious possible failures in Rota.

**Judge:**  
This is absolutely a hard rule: if a user can access another business's data, the task fails regardless of whether the feature otherwise works.

```md
# Authorization and Data Isolation Rules

## Purpose

Rota is a multi-business application.

Every business-owned resource must be isolated from other businesses.

Authorization must be enforced on the backend.

## Authentication First

Every protected request must identify the authenticated user before accessing protected data.

Never trust:

- User ID from request body
- User ID from query
- Role from request body
- Business ID from request body
- Membership ID from request body

Use authenticated server-side identity.

## Business Membership

Before accessing business-owned data:

1. Authenticate the user.
2. Resolve membership for the requested business.
3. Verify membership status.
4. Verify role.
5. Verify resource ownership/access.
6. Apply business rules.
7. Perform the operation.

## Cross-Business Isolation

A user belonging to Business A must never access Business B data.

Test isolation using manipulated:

- Business IDs
- User IDs
- Membership IDs
- Shift IDs
- Swap IDs
- Subscription IDs
- Payment IDs

Changing an identifier must never bypass authorization.

## Role Rules

### Owner

Owner may:

- Manage the business
- Manage billing
- Manage Manager access
- Manage team permissions
- Manage schedules
- Manage swaps
- View authorized business data

### Manager

Manager may:

- Create and manage schedules
- Manage eligible team operations
- Review and approve swaps
- View authorized business data

Manager must not:

- Transfer ownership
- Manage Owner controls
- Change billing unless explicitly permitted

### Staff

Staff may:

- View authorized published schedules
- Manage personal availability
- Manage personal preferences
- Request eligible swaps
- Participate in eligible swaps

Staff must not:

- Create schedules
- Publish schedules
- Approve swaps
- Manage billing
- Manage team permissions
- Access another member's private data without authorization

## Resource Ownership

Never authorize access solely because a resource ID exists.

Verify that the resource belongs to the user's authorized business.

## Backend Enforcement

UI restrictions are not authorization.

Even if a button is hidden from Staff, the backend must reject the operation.

## Mutations

Before every protected mutation:

- Authenticate
- Authorize
- Validate input
- Validate business rules
- Execute transaction where required
- Audit where required

## Testing

Every authorization-sensitive feature must include tests for:

- Allowed role
- Disallowed role
- Wrong business
- Inactive membership
- Invalid resource ownership
- Manipulated IDs

## Failure Rule

If cross-business access is possible, the implementation is considered failed even if all other functionality works.