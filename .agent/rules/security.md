---
trigger: always_on
---


---

# 5. `security.md`

### Debate

**Builder/Engineer:**  
Security rules should be concrete and testable, not generic statements like “write secure code.”

**Product Manager:**  
A security failure can expose customer schedules, staff information, credentials, or business data.

**Judge:**  
Keep rules where violating them creates a real security failure even if the feature appears to work.

```md
# Security Rules

## Purpose

Security is enforced by the backend and database boundaries, not by the mobile application alone.

## Authentication

- Authenticate every protected request.
- Never trust a client-provided user identity.
- Hash passwords securely.
- Never store plaintext passwords.
- Use secure session/token handling.
- Expire sensitive tokens.
- Protect password reset flows.
- Rate-limit authentication endpoints.

## Authorization

Always verify:

1. Authenticated user
2. Business membership
3. Role
4. Resource ownership/access
5. Business rules

Never rely on UI restrictions as authorization.

## Cross-Business Isolation

A user belonging to Business A must never access Business B data by changing:

- Business ID
- User ID
- Membership ID
- Shift ID
- Swap ID
- Subscription ID
- Payment ID
- Any other resource identifier

Every business-owned query must be scoped appropriately.

## Client Input

Treat all client input as untrusted.

Validate:

- Body
- Query parameters
- Route parameters
- Headers
- IDs
- Roles
- Business identifiers
- Monetary values

## Secrets

Never expose server secrets to the mobile application.

Never commit secrets.

Never log:

- Passwords
- Authentication tokens
- Flutterwave secret keys
- Payment credentials
- Sensitive personal data unnecessarily

## Payment Security

- Never trust client payment confirmation.
- Verify Flutterwave payment information server-side.
- Verify webhook authenticity.
- Make webhook processing idempotent.
- Do not allow a client to change subscription state.

## API Security

Protected endpoints must have appropriate authentication and authorization.

Do not expose internal database errors to clients.

Use rate limiting on sensitive endpoints.

## Sensitive Operations

Audit:

- Role changes
- Member removal
- Shift changes
- Schedule publication
- Swap approval/rejection
- Billing changes
- Availability overrides

## Data Exposure

Return only data the authenticated user is authorized to receive.

Do not expose another user's private information unnecessarily.

Do not expose internal IDs or metadata when doing so creates a security risk.

## Security Changes

If a requested implementation creates uncertainty around:

- Authorization
- Authentication
- Privacy
- Payment security
- Data exposure

stop and ask for clarification rather than guessing.