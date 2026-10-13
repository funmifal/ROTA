# Money & Billing Rules

## 1. Locked Payment Provider
- **Provider**: Flutterwave is the locked payment provider for Rota.
- **Scope**: Use Flutterwave for subscription checkouts, payment processing, transaction verification, webhooks, and billing lifecycle events.
- **Prohibition**: Do not replace Flutterwave with Stripe, Paystack, Paddle, Lemon Squeezy, or any other provider. Do not build mock/fake internal payment bypasses.

## 2. Server-Side Verification
- Never trust the mobile client to confirm payment success.
- The Node.js/Express backend must verify Flutterwave payment events via Flutterwave's transaction verification API (`GET https://api.flutterwave.com/v3/transactions/:id/verify`) before updating subscription or billing state.

## 3. Webhook Security & Idempotency
- Flutterwave webhook endpoints (`POST /api/billing/flutterwave/webhook`) must verify the `verif-hash` secret header matching the environment secret. Reject invalid or missing hashes with HTTP 401.
- Webhook processing must be idempotent. Always record and check `flutterwaveTransactionId` / `providerReference` to prevent duplicate processing, double seat increments, or multiple billing charges.
- Hand off verified webhook payloads to a BullMQ background queue for asynchronous, resilient processing.

## 4. Currency and Money Representation
- Store monetary amounts as whole numbers in the smallest supported currency unit (e.g., minor units / kobo for NGN).
- Never use floating-point numbers or floating-point arithmetic for financial calculations.
- Always store currency explicitly alongside payment amounts.

## 5. Subscription & Seat Management
- Rota uses a deterministic monthly per-seat subscription model:
  - Owner: 1 seat
  - Manager: 1 seat
  - Active Staff: 1 seat
  - Inactive members: 0 seats
- Free trial: 14-day free trial without requiring a payment method at start.
- Failure handling: Follow Flutterwave retry rules; keep account in grace period before shifting to read-only mode upon unresolvable failure.
