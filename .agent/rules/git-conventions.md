---
trigger: always_on
---

# Git Conventions

## Purpose

Git history must make Rota changes understandable, reviewable, and reversible.

## Commits

Write focused commits.

A commit should represent one logical change.

Prefer:

```text
feat: add shift conflict validation
fix: prevent duplicate swap approval
fix: verify Flutterwave webhook signature
test: add cross-business authorization coverage