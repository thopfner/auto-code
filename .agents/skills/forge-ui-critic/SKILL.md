---
name: forge-ui-critic
description: Perform a read-only adversarial UI review against the repo's design system, active brief, screenshots, and changed files. Use as a specialized second-pass critic after UI implementation, before final QA, or when you want a strict standards enforcer that identifies violations without writing code or changing the plan.
---

# FORGE UI Critic

## Overview

Use this skill as a focused, read-only UI reviewer.

This skill should not write code, rewrite the plan, or broaden scope. Its job is to identify violations, drift, weak spots, and missing evidence.

Use it:

- after a worker finishes an important UI batch
- before final UI QA on a major surface
- when a planner wants an adversarial second opinion on whether the proposed UI direction is coherent
- when a coding agent should self-critique without inventing new implementation work

Read only what you need:

- `references/critic-rubric.md`

## Workflow

### 1. Read the governing materials

Inspect:

- repo UI docs
- active brief and UI planning artifacts
- changed frontend files
- screenshots, Storybook states, or live browser evidence when available

### 2. Stay read-only

Do not:

- edit files
- rewrite architecture
- re-scope the task
- propose unrelated enhancements

Your role is to point out what fails the standard, not to redesign the product from scratch.

### 3. Look for violations, not vibes

Focus on:

- drift from tokens or primitives
- inconsistent hierarchy or density
- unclear primary action
- missing or weak states
- responsive breakdowns
- accessibility misses
- insufficient evidence

### 4. Return a tight violation report

Findings should be:

- ordered by severity
- concrete
- tied to evidence
- explicit about whether the problem is confirmed or inferred

If evidence is missing, say so. Do not overstate certainty.

## Output Rules

- findings first
- no code changes
- no patch suggestions unless the caller explicitly asks for them after the review
- if the UI is good enough, say that explicitly and note any residual risk from missing evidence
