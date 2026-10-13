# Authentication & Account Flows Skill

## Purpose

Use this skill whenever implementing, modifying, reviewing, or debugging authentication and account-access flows in Rota.

This skill covers:
- Signup
- Login
- Logout
- Email verification
- Password reset
- Session creation and validation
- Protected requests
- Authentication-related rate limiting
- Authentication error handling

This skill does not define general authorization or business-resource permissions. Use the Authorization & Data Isolation skill for those concerns.

---

## When to Load This Skill

Load this skill when a task involves:

- Creating or modifying signup
- Creating or modifying login
- Creating or modifying logout
- Email verification
- Password reset or password recovery
- Session handling
- Authentication middleware
- Protected API requests
- Authentication rate limits
- Password hashing
- Authentication security bugs
- Authentication tests

---

## Required Rules

Follow these project rules:

- Backend authentication is authoritative.
- Never trust authentication state supplied by the client.
- Passwords must never be stored in plaintext.
- Authentication secrets must never be exposed to the mobile client.
- Sensitive authentication operations must be rate limited.
- Sessions must be securely created, stored, validated, and invalidated.
- Authentication failures must not leak sensitive account information.
- Use the project's existing database and security rules.
- Do not introduce a second authentication system without explicit approval.

---

## Authentication Workflow

Always follow this order:

1. Receive request.
2. Validate request input.
3. Apply authentication-specific rate limits.
4. Retrieve the required account/session data.
5. Perform the authentication operation.
6. Apply security checks.
7. Create, update, or invalidate the session as required.
8. Persist changes.
9. Return a safe response.
10. Test both successful and failed paths.

Do not skip validation or security checks because the request comes from the mobile application.

---

## Signup Workflow

When implementing signup:

1. Validate the request body.
2. Validate required fields.
3. Normalize values where the existing product rules require it.
4. Apply signup rate limits.
5. Check whether the account already exists.
6. Handle duplicate signup safely.
7. Hash the password using the approved password hashing strategy.
8. Create the account.
9. Create required verification/session records.
10. Send required verification communication.
11. Return only safe account information.
12. Never return password hashes or security tokens unnecessarily.
13. Test duplicate and concurrent signup attempts.

Signup must not bypass authorization or business membership rules.

---

## Login Workflow

When implementing login:

1. Validate email/identifier and password input.
2. Apply login rate limits.
3. Retrieve the account.
4. Perform password verification.
5. Apply account status and lockout checks.
6. Use timing-safe behavior for failed authentication where required.
7. Create a secure session after successful authentication.
8. Persist the session.
9. Return safe account information.
10. Never expose password hashes.
11. Never expose internal authentication details.

Failed login responses must not reveal whether sensitive account details exist unless explicitly required by the product.

---

## Logout Workflow

When implementing logout:

1. Authenticate the current session.
2. Identify the current session.
3. Invalidate the session.
4. Persist the invalidation.
5. Return a safe success response.

Logout should be safe to repeat.

---

## Email Verification Workflow

When implementing verification:

1. Validate the verification request.
2. Validate the verification token/code.
3. Check expiration.
4. Check whether the token has already been used.
5. Verify the account association.
6. Mark the account as verified.
7. Invalidate the verification token where applicable.
8. Persist the transaction.
9. Return a safe response.
10. Test expired, invalid, reused, and successful verification.

---

## Password Reset Workflow

When implementing password reset:

1. Accept the reset request.
2. Apply rate limiting.
3. Avoid leaking whether an account exists.
4. Generate a secure reset token.
5. Store the token securely.
6. Apply the required expiration.
7. Send the reset communication.
8. Validate the reset token when the user submits a new password.
9. Check expiration and token validity.
10. Hash the new password.
11. Update the account.
12. Invalidate the reset token.
13. Invalidate sessions if required by the project's security rules.
14. Return a safe response.

---

## Session Workflow

Sessions must be:

- Server-controlled
- Securely generated
- Expirable
- Revocable
- Associated with the correct user
- Protected from unauthorized reuse

For every protected request:

1. Extract the session.
2. Validate the session.
3. Resolve the authenticated user.
4. Check account status.
5. Continue to authorization.

Authentication proves who the user is.

Authorization determines what that user can do.

---

## Error Handling

Authentication errors must:

- Be predictable
- Avoid exposing secrets
- Avoid exposing password hashes
- Avoid exposing internal database details
- Avoid revealing unnecessary account existence information
- Return appropriate HTTP status codes

Do not return raw database or provider errors to clients.

---

## Testing Requirements

Test at minimum:

### Success

- Signup succeeds.
- Login succeeds.
- Logout succeeds.
- Verification succeeds.
- Password reset succeeds.
- Protected request succeeds with a valid session.

### Failure

- Invalid signup input.
- Duplicate account.
- Invalid password.
- Unknown account.
- Expired session.
- Invalid session.
- Expired verification token.
- Invalid verification token.
- Expired password reset token.
- Invalid password reset token.
- Rate limit triggered.
- Locked account where applicable.

### Security

- Password is never stored plaintext.
- Password hash is never returned.
- Session cannot be forged.
- Expired sessions are rejected.
- Authentication cannot be bypassed through client-provided fields.

---

## Completion Checklist

Before considering authentication work complete:

- [ ] Input validation exists.
- [ ] Rate limiting exists where required.
- [ ] Passwords are securely hashed.
- [ ] Sessions are secure.
- [ ] Authentication errors are safe.
- [ ] No secrets are exposed.
- [ ] Database changes are transactional where required.
- [ ] Success and failure paths are tested.
- [ ] Typecheck passes.
- [ ] Lint passes.
- [ ] Relevant tests pass.
- [ ] Existing authentication behavior was not accidentally broken.

---

## Boundary

Use this skill for authentication.

Use the Authorization & Data Isolation skill for:

- Roles
- Business membership
- Resource ownership
- Business isolation
- Owner/Manager/Staff permissions