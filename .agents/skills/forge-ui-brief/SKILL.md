---
name: auto-forge-ui-brief
description: Strengthen planning for UI and UX work by turning design intent into strict repo-grounded implementation criteria. Use for new frontend features, dashboard redesigns, page flows, forms, tables, navigation, onboarding, settings surfaces, or any task where the implementation brief needs explicit user journeys, states, breakpoints, reuse rules, and screenshot acceptance criteria.
---

# FORGE UI Brief

## Overview

Use this skill to make UI planning concrete enough that a coding agent can execute it without improvising the visual system.

This skill does not replace [$auto-forge-plan](.agents/skills/forge-plan/SKILL.md) or [$auto-forge-qa-brief](.agents/skills/forge-qa-brief/SKILL.md). It strengthens them when the task has a meaningful UI surface.

Read only what you need:

- `references/planning-artifacts.md`
- `references/repo-ui-docs.md`

## When To Use

- new product surfaces
- major UI revisions
- onboarding or settings flows
- dashboards, tables, forms, and detail screens
- admin interfaces
- UI work where “good UX” is not already obvious from existing code
- any frontend change where screenshots, responsive states, or reuse rules should be explicit in the brief

Do not use this skill for tiny cosmetic tweaks unless the user explicitly wants stricter UI planning.

## Workflow

### 1. Inspect the real UI system first

Before writing UI criteria:

- inspect the current frontend code
- identify reusable primitives and patterns
- inspect existing live or local screens when practical
- find the nearest visual precedent in the repo

Do not write a UI brief from generic product instincts alone.

### 2. Decide whether the repo needs UI-memory reinforcement

If the repo lacks durable UI docs, call it out and recommend or create repo-local UI files before large UI batches:

- `docs/ui/FRONTEND.md`
- `docs/ui/TOKENS.md`
- `docs/ui/PATTERNS.md`
- `docs/ui/REFERENCE_SCREENS.md`

When repo-memory maintenance is in scope, prefer using [$auto-forge-memory](.agents/skills/forge-memory/SKILL.md) with `--include-ui` rather than inventing ad hoc UI docs.

Do not make the brief depend on undocumented style assumptions if the UI work will span multiple sessions.

### 3. Produce UI-specific planning artifacts

For significant UI work, the active brief should include the relevant subset of:

- user goal and primary task flow
- exact surfaces and routes affected
- primitives and components to reuse
- states that must exist
- breakpoints and responsive expectations
- accessibility constraints
- exact screenshot or visual evidence requirements
- forbidden shortcuts or drift risks

Use the artifact guidance in `references/planning-artifacts.md`.

### 4. Force visual specificity without over-designing

A good UI brief should say:

- what the user is trying to achieve
- what the primary action is
- which existing surface this should resemble
- which patterns must be reused
- which state transitions must be proven

It should not micromanage irrelevant paint choices if the repo already has a system.

### 5. Make evidence part of the plan

Every meaningful UI brief should define acceptance evidence such as:

- viewport screenshots
- exact routes or states to inspect
- Storybook stories or component states if the repo uses Storybook
- Playwright flows when user journeys matter

If the UI cannot be judged from code alone, say that directly and require browser evidence in the implementation pack.

## Output Rules

- when used during planning, return the UI-specific constraints that must be embedded in the next execution pack
- when used before a handoff, strengthen the active brief instead of producing a separate vague design note
- when the repo lacks UI docs, recommend the minimum repo-local files needed to stop future UI drift
- treat `docs/ui/*` as the canonical UI-memory location and root-level UI docs only as legacy fallback
