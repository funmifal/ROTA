# Authorization & Data Isolation Skill

## Purpose

Use this skill whenever implementing, modifying, reviewing, or debugging permissions, business membership, resource ownership, or cross-business data isolation.

Authentication identifies the user.

Authorization determines whether that authenticated user may perform the requested operation.

---

## When to Load This Skill

Load this skill when a task involves:

- Owner permissions
- Manager permissions
- Staff permissions
- Business membership
- Resource ownership
- Business-scoped queries
- Protected API resources
- Cross-business data access
- Role changes
- Permission checks
- Authorization middleware
- Authorization security bugs

---

## Required Authorization Order

For every protected operation, follow this order:

1. Authenticate the request.
2. Resolve the user's business membership.
3. Check membership status.
4. Check the user's role.
5. Resolve the requested resource.
6. Verify resource ownership/business ownership.
7. Apply the operation-specific business rules.
8. Perform the operation.
9. Audit the operation when required.
10. Return only data the user is allowed to access.

Do not reverse this order.

---

## Business Isolation

Every business-owned resource must remain inside its business boundary.

Never trust a business ID supplied by the mobile client.

The server must determine the user's business membership from authenticated server-side data.

When accessing a resource:

1. Resolve the authenticated user.
2. Resolve the business membership.
3. Determine the authorized business.
4. Query the resource within that business scope.
5. Reject resources belonging to another business.

A valid resource ID is not enough.

The resource must also belong to the user's authorized business.

---

## Role Rules

### OWNER

The Owner may:

- Manage the business.
- Manage team membership.
- Manage billing.
- Manage managers and staff.
- Perform Owner-level administrative actions.

There is one Owner per business in MVP.

### MANAGER

Managers may:

- Create shifts.
- Edit shifts.
- Publish schedules.
- Manage scheduling operations.
- Approve swaps according to product rules.

Managers must not:

- Transfer ownership.
- Perform Owner-only billing operations.
- Modify Owner controls.

### STAFF

Staff may:

- View their published shifts.
- Manage their availability/preferences where supported.
- Request shift swaps.
- Respond to relevant scheduling actions.

Staff must not:

- Create shifts.
- Edit shifts.
- Publish schedules.
- Approve swaps.
- Manage billing.
- Manage team permissions.

---

## Resource Authorization

Before modifying any resource:

1. Authenticate the user.
2. Resolve the business.
3. Check membership.
4. Check role.
5. Load the resource within that business.
6. Verify the resource is eligible for the requested operation.
7. Apply business rules.
8. Perform the mutation.
9. Audit if required.

Never perform:

```text
find resource by ID
→ update resource