
---

# 4. `.agents/skills/shift-swap-workflow/SKILL.md`

```md
# Shift Swap Workflow Skill

## Purpose

Use this skill whenever implementing, modifying, reviewing, or debugging shift swap requests and approvals.

A swap is a controlled scheduling mutation and must be revalidated before approval.

---

## When to Load This Skill

Load this skill when a task involves:

- Creating a swap request
- Responding to a swap request
- Cancelling a swap request
- Approving a swap
- Rejecting a swap
- Validating swap eligibility
- Reassigning a shift through a swap
- Swap notifications
- Swap audit records

---

## Swap Lifecycle

The workflow is:

```text
Request
→ Validate
→ Pending
→ Response
→ Approval
→ Re-check
→ Transaction
→ Audit
→ Notify