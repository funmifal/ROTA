# ROTA — Security Architecture & Threat Model

This document outlines the security architecture of Rota, provides an audit of client-side environment variables, and details mitigations for eight primary application security threats in compliance with **Requirement 4: Security**.

---

## 1. Client Bundle Environment Variable Audit

In mobile frameworks like React Native with Expo, any code or environment variable prefixed with `EXPO_PUBLIC_` is inlined into the client JavaScript bundle at build time. Because mobile APK and IPA binaries can be unpacked and reverse-engineered with standard tools (e.g. `apktool`, `strings`, `unzip`), **anything in a mobile app is public**.

### Full Audit of `EXPO_PUBLIC_` Variables

A full static analysis search was conducted across the entire mobile codebase (`Frontend/`):

| Variable Name | Value / Default Fallback | Purpose | Why It Is Safe to Expose |
| :--- | :--- | :--- | :--- |
| `EXPO_PUBLIC_API_URL` | `http://192.168.100.7:5000` | Specifies the base HTTP/HTTPS URL of the backend API gateway. | Contains no credentials, keys, or secrets. It is solely the public network destination for REST API calls. All endpoints require server-validated Bearer tokens. |

### Verification of Zero Sensitive Secrets in the Mobile Bundle
- **Payment Provider Keys**: Flutterwave secret keys (`FLW_SECRET_KEY`, `FLW_SECRET_HASH`) and webhook secrets are stored exclusively in `Backend/.env` and are never referenced in the mobile app. All payment charges and checkout sessions are initiated by the server.
- **Database & In-Memory Store**: `DATABASE_URL` (PostgreSQL) and `REDIS_URL` are strictly confined to the backend runtime.
- **Authentication Secrets**: `JWT_SECRET`, password hashing salts (`BCRYPT_SALT_ROUNDS`), and SMTP credentials reside strictly on the server.

---

## 2. Threat Modeling & Security Mitigations

Below are eight critical threats to Rota and the concrete architectural and code defenses implemented to handle each.

---

### Threat 1: Reverse-Engineering & Mobile Secret Extraction (Client-Side Key Leakage)
- **Scenario / Threat**: A malicious user or competitor decompiles the Android APK or iOS IPA, unzips the JavaScript bundle, and searches for embedded secrets (such as payment API keys, AWS keys, or database credentials). If a payment secret key is embedded (as in Tobi's scenario), the attacker can read customer data, issue unauthorized refunds, or initiate fraudulent transfers.
- **How Rota Handles It**:
  1. **Strict Server-Side Isolation**: All external API integrations (including Flutterwave checkout and webhooks) are completely isolated behind backend services.
  2. **No Client Secrets**: As proven in the environment variable audit above, only `EXPO_PUBLIC_API_URL` is bundled.
  3. **Zero Direct Client Payments**: The mobile app never calls payment gateways directly; the backend creates checkout sessions and validates webhooks using server-side signatures (`verif-hash`).

---

### Threat 2: Broken Object-Level Authorization (BOLA / IDOR / Cross-Tenant Data Leaks)
- **Scenario / Threat**: A user registered in Business A manipulates a path parameter or request body (e.g. changing `:businessId`, `shiftId`, or `memberId` in Postman) to read or modify schedules, rosters, or activity logs belonging to Business B.
- **How Rota Handles It**:
  1. **Server-Side Membership Resolution (`requireBusinessMember`)**: Every business-scoped request validates that the authenticated user has an `ACTIVE` membership in the requested `businessId`.
  2. **Explicit Query Scoping**: Every Prisma database query enforces tenant boundaries (`where: { businessId: membership.businessId, ... }`).
  3. **Rejection with `403 Forbidden`**: Access attempts across tenant boundaries are rejected immediately before querying data.
  4. **Automated Verification**: Proven by `test_security_requirement4.ts` (Test 2: cross-tenant shift and member queries return `403 Forbidden`).

---

### Threat 3: Broken Function-Level Authorization (Privilege Escalation / Staff Calling Manager Endpoints)
- **Scenario / Threat**: A Staff user bypasses mobile UI restrictions (such as hidden "Delete Shift" or "Manage Billing" buttons) by sending direct HTTP requests using Postman or cURL to delete shifts, alter team rosters, or tamper with subscriptions.
- **How Rota Handles It**:
  1. **Server-Side Role Enforcement (`requireBusinessRole`)**: The server derives user roles strictly from trusted server-side database records, never from client-supplied headers or body parameters.
  2. **Endpoint Defense**: The shift deletion route (`DELETE /api/businesses/:businessId/shifts/:shiftId`) is protected with:
     ```ts
     requireAuth,
     requireBusinessMember,
     requireBusinessRole(MembershipRole.OWNER, MembershipRole.MANAGER),
     ShiftController.deleteShift
     ```
  3. **Staff Access Rejection**: If a `STAFF` member sends a delete request, the server immediately returns `403 Forbidden` with:
     `{"error": "Forbidden", "message": "Your role (STAFF) does not have permission to perform this action. Required: OWNER or MANAGER."}`
  4. **Automated Verification**: Proven by `test_security_requirement4.ts` (Test 1: Staff user rejected with 403; Owner succeeds with 200).

---

### Threat 4: Refresh Token Theft & Replay Attacks
- **Scenario / Threat**: An attacker intercepts or extracts an active refresh token and attempts to use it repeatedly to obtain access tokens after a user's session should have terminated.
- **How Rota Handles It**:
  1. **Refresh Token Rotation (RTR)**: Every time a refresh token is exchanged, it is immediately marked as used and a brand-new refresh token and family pair is issued.
  2. **Token Reuse & Theft Detection**: Each token belongs to a `familyId`. If an already-used refresh token is presented, Rota detects that the token was compromised, revokes all tokens within that family, logs a security audit event (`SUSPICIOUS_TOKEN_REUSE_DETECTED`), and increments `user.tokenVersion`, instantly invalidating all sessions across all devices.
  3. **Short-Lived Access Tokens**: Access tokens expire after 15 minutes, limiting the exposure window.

---

### Threat 5: Brute-Force & Credential Stuffing / Denial of Service
- **Scenario / Threat**: Attackers use automated botnets to brute-force passwords on `/api/auth/login`, flood `/api/auth/forgot-password` to exhaust email quotas, spam team invitations, or rapidly initiate checkouts to exhaust provider limits.
- **How Rota Handles It**:
  1. **Redis-Backed Rate Limiting (`Backend/src/middleware/rateLimiter.ts`)**:
     - **Login**: Max 5 attempts per 15 minutes per IP/email.
     - **Password Reset**: Max 3 requests per 15 minutes per IP/email.
     - **Invitations**: Max 10 invitations per 1 hour per business/IP.
     - **Billing / Checkout**: Max 5 initiations per 15 minutes per business/user.
  2. **Standard 429 Responses**: Returns `429 Too Many Requests` with `Retry-After` headers and time-to-reset.
  3. **Resilient Fallback**: If Redis is offline during local development, an in-memory sliding window ensures rate limiting continues uninterrupted.
  4. **Automated Verification**: Proven by `test_security_requirement4.ts` (Test 4: triggers 429 after threshold).

---

### Threat 6: Malformed Payloads, Mass Assignment & Injection Attacks
- **Scenario / Threat**: Attackers submit malformed JSON payloads, injected SQL/script fragments, or extra fields (e.g. attempting mass-assignment like `role: "OWNER"` during sign-up).
- **How Rota Handles It**:
  1. **Server-Side Zod Validation (`validateBody`)**: Every POST, PUT, and PATCH endpoint parses and validates incoming payloads with strict Zod schemas before reaching business logic.
  2. **Mass-Assignment Prevention**: Any unexpected attributes not explicitly permitted by the schema are rejected or ignored.
  3. **SQL Injection Defense**: All database operations use Prisma ORM with parameterized queries, preventing SQL injection vulnerabilities.
  4. **Automated Verification**: Proven by `test_security_requirement4.ts` (Test 3: malformed payloads rejected with `400 ValidationError`).

---

### Threat 7: Man-in-the-Middle (MitM) & Transport Layer Eavesdropping
- **Scenario / Threat**: An attacker intercepts network traffic on a public Wi-Fi network, reading access tokens or credential parameters in transit.
- **How Rota Handles It**:
  1. **Enforced HTTPS/TLS**: In production, all API communication is restricted to TLS 1.3 / HTTPS.
  2. **URL Parameter Protection**: Express security middleware automatically rejects requests if sensitive fields (e.g. `password`, `pwd`, `token`) are found in URL query parameters, preventing credential leakage in web server access logs and browser histories.
  3. **Strict CORS Policy**: Configured to restrict origin headers and disallow unverified origins.

---

### Threat 8: Insecure Client Storage & Device Compromise
- **Scenario / Threat**: An attacker gains access to a lost, stolen, or rooted device and inspects unencrypted local storage (such as default `AsyncStorage`) to steal long-lived authentication tokens.
- **How Rota Handles It**:
  1. **Hardware-Backed Secure Storage**: Authentication tokens (access token and refresh token) are stored exclusively using `expo-secure-store`, backed by:
     - iOS: Keychain Services with Secure Enclave hardware encryption.
     - Android: Android Keystore with AES-256-GCM encryption.
  2. **Non-Sensitive Offline Cache**: `AsyncStorage` is only used for non-sensitive presentation caching (such as offline upcoming shifts), and contains no passwords, session tokens, or private billing keys.

---

## 3. Automated Test Suite Verification

The security controls are validated via automated tests in `Backend/src/test_security_requirement4.ts`:

```bash
$ npx tsx src/test_security_requirement4.ts

====================================================
 RUNNING SECURITY REQUIREMENT 4 AUTOMATED TEST SUITE
====================================================

[Setup] Creating Tenant A and Tenant B...
[Setup Complete] Seeded 2 businesses, 3 users, and 2 shifts.

--- TEST 1: Server-side RBAC Enforcement ---
Staff delete shift response: Status 403 {
  error: 'Forbidden',
  message: 'Your role (STAFF) does not have permission to perform this action. Required: OWNER or MANAGER.'
}
✅ TEST 1A PASSED: Staff user calling "delete shift" endpoint directly was REJECTED with 403 Forbidden.
Owner delete shift response: Status 200 {
  message: 'Shift deleted successfully.'
}
✅ TEST 1B PASSED: Authorized Owner successfully deleted shift.

--- TEST 2: Cross-Tenant Data Isolation ---
Cross-tenant shifts query: Status 403 {
  error: 'Forbidden',
  message: 'You are not a member of this business.'
}
Cross-tenant members query: Status 403 {
  error: 'Forbidden',
  message: 'You are not a member of this business.'
}
✅ TEST 2 PASSED: Cross-tenant access strictly blocked with 403 Forbidden on server.

--- TEST 3: Server-side Zod Schema Body Validation ---
Invalid registration response: Status 400 { error: 'ValidationError', ... }
Invalid invitation response: Status 400 { error: 'ValidationError', ... }
✅ TEST 3 PASSED: Malformed and invalid request bodies rejected with 400 ValidationError by Zod.

--- TEST 4: Redis Rate Limiting ---
Attempt 6: Rate limiter triggered HTTP 429 TooManyRequests
✅ TEST 4 PASSED: Rate limiter successfully triggered HTTP 429 TooManyRequests.

--- TEST 5: Billing RBAC Authorization ---
Staff billing checkout response: Status 403 { error: 'Forbidden' }
Owner billing checkout response: Status 200 { checkout: { paymentUrl: '...' } }
✅ TEST 5 PASSED: Staff strictly blocked from billing checkout (403), Owner authorized (200).

====================================================
 RESULTS: 6 PASSED | 0 FAILED
====================================================
```
