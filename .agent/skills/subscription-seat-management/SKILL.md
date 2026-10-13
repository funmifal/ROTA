
---

# 6. `.agents/skills/subscription-seat-management/SKILL.md`

```md
# Subscription & Seat Management Skill

## Purpose

Use this skill whenever implementing or modifying billable seat calculation, team membership changes that affect billing, subscription state, trials, failed payments, cancellation, or expiry.

This skill works alongside the Flutterwave Billing skill.

---

## When to Load This Skill

Load this skill when a task involves:

- Billable seat calculation
- Adding team members
- Removing team members
- Activating/deactivating members
- Owner seat
- Manager seat
- Staff seat
- Subscription limits
- 14-day trial
- Subscription status
- Failed payment state
- Subscription expiry
- Cancellation at period end

---

## Billable Seat Rules

The MVP seat calculation is:

```text
Owner = 1 seat

Active Manager = 1 seat

Active Staff = 1 seat

Inactive member = 0 seats