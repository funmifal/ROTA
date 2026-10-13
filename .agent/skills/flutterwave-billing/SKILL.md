
---

# 5. `.agents/skills/flutterwave-billing/SKILL.md`

```md
# Flutterwave Billing Skill

## Purpose

Use this skill whenever implementing, modifying, reviewing, or debugging Flutterwave payments, checkout, transaction verification, webhooks, or subscription billing events.

Flutterwave is the only payment provider for Rota MVP.

The backend is the source of truth for payment and subscription state.

---

## When to Load This Skill

Load this skill when a task involves:

- Flutterwave checkout
- Payment initialization
- Payment verification
- Payment webhooks
- Payment records
- Subscription activation
- Payment failures
- Subscription renewal
- Cancellation at period end
- Billing state changes
- Payment security
- Payment idempotency

---

## Required Rules

- Never trust payment success reported by the mobile client.
- Never activate a subscription solely because checkout returned successfully.
- Verify transactions server-side.
- Verify provider references.
- Verify amount and currency.
- Verify the payment belongs to the expected business/customer.
- Webhooks must be authenticated according to Flutterwave requirements.
- Webhook processing must be idempotent.
- Money must use integer minor units.
- Never use floating-point arithmetic for money.
- Flutterwave secrets must remain server-side.
- Payment and subscription state changes must be auditable.

---

## Checkout Workflow

Use:

```text
Authenticate
→ Authorize billing operation
→ Validate billing request
→ Calculate authoritative amount
→ Create payment reference
→ Initialize Flutterwave transaction
→ Return checkout information