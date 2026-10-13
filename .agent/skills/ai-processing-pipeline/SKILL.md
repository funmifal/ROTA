
---

# 7. `.agents/skills/ai-processing-pipeline/SKILL.md`

```md
# AI Processing Pipeline Skill

## Purpose

Use this skill whenever implementing, modifying, reviewing, or debugging AI-assisted functionality in Rota.

AI is advisory.

AI must never become the authoritative source for core business rules.

---

## When to Load This Skill

Load this skill when a task involves:

- AI-assisted scheduling
- AI-generated scheduling suggestions
- AI processing
- AI provider integration
- AI prompt construction
- AI output parsing
- AI validation
- AI provider errors
- AI rate limits
- AI-generated mutations
- AI-assisted recommendations

---

## Core Principle

AI output is untrusted input.

The application must never assume that an AI response is:

- Correct
- Complete
- Authorized
- Safe
- Consistent with business rules

AI suggestions must be validated by deterministic application logic.

---

## AI Processing Workflow

Always follow:

```text
User Request
→ Validate Input
→ Check Authorization
→ Prepare Safe Context
→ AI Processing
→ Validate AI Output
→ Apply Deterministic Business Rules
→ Present Suggestion
→ User Approval
→ Re-authorize
→ Database Transaction
→ Audit
→ Notify