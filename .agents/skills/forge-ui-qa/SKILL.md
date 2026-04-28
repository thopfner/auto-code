---
name: forge-ui-qa
description: Audit implemented UI against the repo's design system, active brief, live behavior, responsive states, accessibility, and screenshot evidence. Use after frontend changes, before shipgates on UI-heavy work, or when auditing whether a product surface actually meets professional SaaS UI and UX standards.
---

# FORGE UI QA

## Overview

Use this skill for frontend and UX review when visual quality matters enough that code-only review is insufficient.

This skill works especially well with:

- [$forge-bootstrap](.agents/skills/forge-bootstrap/SKILL.md) for remote repo rehydration
- [$forge-qa-brief](.agents/skills/forge-qa-brief/SKILL.md) when the UI review is part of a phase-clearance workflow
- [$playwright](.agents/skills/playwright/SKILL.md) for browser evidence
- [$screenshot](.agents/skills/screenshot/SKILL.md) when visual artifacts are needed

Read only what you need:

- `references/qa-rubric.md`

## Workflow

### 1. Rehydrate from UI truth and active brief

Read:

- the relevant repo-memory files
- repo-local UI docs if present
- the active brief and any UI planning artifacts
- the changed frontend files

If the task is a remote QA stop, do not rely on prior chat context. Re-read the repo.

### 2. Inspect both code truth and live truth

UI QA is incomplete if it only reads code when the behavior is visible and testable.

Minimum expected evidence for meaningful UI changes:

- changed files and diff
- one live browser pass or visual artifact set when practical
- responsive check at at least mobile and desktop widths
- state validation for the affected surface

### 3. Classify findings correctly

Separate findings into:

- design-system drift
- functional UX bug
- responsive regression
- accessibility issue
- incomplete state coverage
- missing evidence or unverifiable claim

Do not collapse all UI problems into “needs polish.”

### 4. End with a clear verdict

If the UI review is part of an implementation brief lineage, end with exactly one of:

- `CLEAR_CURRENT_PHASE`
- `REVISION_PACK_REQUIRED`
- `REPLAN_REQUIRED`
- `BLOCKED_EXTERNAL`

If this is a standalone audit, findings plus residual risks are sufficient.

## Output Rules

- findings first, ordered by severity
- prefer evidence-backed claims over aesthetic intuition
- include file references when the problem is code-visible
- include viewport or state context when the problem is visual
- call out missing screenshots, missing state coverage, or missing accessibility evidence explicitly
