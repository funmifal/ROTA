---
trigger: always_on
---

# Coding Standards

## Purpose

These rules define how production code must be written for Rota.

The goal is readable, maintainable, predictable code that preserves product and security requirements.

## TypeScript

- Use strict TypeScript.
- Do not use `any` unless there is a documented and unavoidable reason.
- Prefer explicit types at system boundaries.
- Do not use type assertions to hide real type errors.
- Use discriminated unions for state-heavy logic where appropriate.
- Keep shared domain types consistent between layers.

## Separation of Concerns

- Keep controllers thin.
- Put business rules in services/domain logic.
- Keep database access inside the appropriate data/service layer.
- Keep external provider integrations behind dedicated services.
- Do not place Flutterwave API calls inside mobile screens or UI components.
- Do not place database queries directly inside mobile code.
- Do not duplicate the same business rule across multiple controllers.

Preferred backend flow:

Route
→ Authentication
→ Authorization
→ Validation
→ Controller
→ Service
→ Database/External Provider

## Functions

- Keep functions focused on one responsibility.
- Do not create large functions containing unrelated business logic.
- Extract logic when doing so makes the business rule easier to understand or test.
- Do not create abstractions merely to reduce line count.

## Naming

- Use meaningful names.
- Use domain terminology consistently.
- Prefer names such as `shiftAssignment`, `membership`, `swapRequest`, and `subscription`.
- Avoid unexplained abbreviations.
- Do not use misleading names that hide side effects.

## Error Handling

- Handle expected errors explicitly.
- Do not silently swallow errors.
- Do not return successful responses when an important operation failed.
- Do not expose secrets, stack traces, database internals, or provider credentials to clients.
- Return consistent API error structures.

## Validation

- Validate all external input at the backend boundary.
- Do not rely only on mobile-side validation.
- Validate request bodies, query parameters, route parameters, and relevant headers.
- Validate business rules after input validation.

## Async Operations

- Handle promise failures explicitly.
- Do not create unhandled asynchronous operations for critical work.
- Do not report a mutation as successful before the authoritative operation succeeds.

## Environment Variables

- Never hardcode secrets.
- Never commit credentials.
- Add new required environment variables to `.env.example`.
- Validate required environment configuration during server startup where appropriate.

## Dependencies

- Prefer stable and maintained dependencies.
- Do not add a dependency when existing project capabilities are sufficient.
- Do not upgrade dependencies without a reason.
- Do not introduce experimental technology into critical flows without explicit approval.

## Comments

- Comment non-obvious business logic.
- Do not write comments that merely repeat what the code already says.
- When a workaround is required, explain why it exists.

## Testing

Business-critical logic must have automated tests.

Prioritize tests for:

- Authentication
- Authorization
- Cross-business isolation
- Shift conflicts
- Availability rules
- Schedule publishing
- Shift swaps
- Seat counting
- Billing
- Flutterwave webhook handling
- Subscription state changes

## Completion

Code is not complete because it compiles.

Before completion:

- Typecheck
- Lint
- Run relevant tests
- Verify business rules
- Verify authorization
- Verify error handling
- Verify no secrets were introduced
- Verify no out-of-scope behaviour was added