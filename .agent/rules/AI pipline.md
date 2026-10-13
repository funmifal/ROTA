---
trigger: always_on
---

# AI Pipeline Rules

## Purpose

AI is optional and advisory in Rota.

The core scheduling system must not depend on AI to remain correct.

## AI Is Not the Source of Truth

Never use AI as the authoritative source for:

- Authorization
- Permissions
- Shift conflict detection
- Swap approval
- Seat calculation
- Billing
- Payment verification
- Subscription state
- Final database mutations

Deterministic application logic remains authoritative.

## Input

Treat all AI inputs as untrusted.

Validate and sanitize data before sending it to an AI provider where appropriate.

Do not send unnecessary private data to an AI provider.

## Output

Treat all AI output as untrusted.

Never directly persist AI output into important business state without validation.

AI output must pass through deterministic application rules.

## AI Suggestions

AI may provide:

- Schedule suggestions
- Staffing suggestions
- Explanations
- Summaries
- Natural-language assistance

Suggestions must remain distinguishable from confirmed actions.

## User Approval

AI must never silently:

- Create shifts
- Modify shifts
- Cancel shifts
- Assign staff
- Approve swaps
- Change permissions
- Change billing
- Modify subscription state

Where AI proposes a mutation, require explicit user approval before applying it.

## Mutation Pipeline

For AI-assisted mutations:

```text
User Request
→ Validate Input
→ AI Processing
→ Validate AI Output
→ Apply Deterministic Business Rules
→ User Approval
→ Authorize User
→ Database Transaction
→ Audit
→ Notify