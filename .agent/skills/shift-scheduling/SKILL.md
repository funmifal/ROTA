
---

# 3. `.agents/skills/shift-scheduling/SKILL.md`

```md
# Shift Scheduling Skill

## Purpose

Use this skill whenever creating, editing, assigning, publishing, viewing, or cancelling shifts and schedules.

The backend is the authoritative source of scheduling truth.

---

## When to Load This Skill

Load this skill when a task involves:

- Creating shifts
- Editing shifts
- Assigning staff
- Removing assignments
- Publishing schedules
- Editing published shifts
- Cancelling shifts
- Viewing schedules
- Shift conflict detection
- Availability validation
- Overnight shifts
- Schedule integrity

---

## Required Workflow

Always follow this sequence:

1. Authenticate the requester.
2. Resolve business membership.
3. Check membership status.
4. Check role permission.
5. Validate shift input.
6. Resolve referenced staff/location/department.
7. Validate business ownership.
8. Validate time boundaries.
9. Validate availability.
10. Detect conflicts.
11. Apply scheduling business rules.
12. Persist the operation transactionally where required.
13. Record audit information.
14. Notify affected users only after successful persistence.
15. Return the resulting schedule data.

---

## Shift Time Validation

A shift must have valid start and end timestamps.

Reject:

- Missing start time.
- Missing end time.
- Invalid timestamps.
- Zero-length shifts.
- End time before start time.

Overnight shifts must use complete timestamps rather than comparing clock times alone.

Example:

```text
22:00 → 06:00