---
name: auto-forge-ui-core
description: Enforce a repo-grounded UI system for SaaS products. Use for frontend implementation, redesigns, component work, dashboards, forms, tables, navigation, empty states, or any task where UI consistency matters. Read repo UI docs, design tokens, component patterns, and reference screens before coding; require semantic tokens, primitive reuse, responsive states, accessibility, and screenshot-backed self-review.
---

# FORGE UI Core

## Overview

Use this skill as the default UI system layer for serious product work.

This skill is not a replacement for product planning or QA. It is the enforcement layer that keeps frontend work coherent across sessions, agents, and repositories.

Use it with:

- [$auto-forge-bootstrap](.agents/skills/forge-bootstrap/SKILL.md) when the repo lives on a VPS and context must be rehydrated first
- [$auto-forge-plan](.agents/skills/forge-plan/SKILL.md) and [$auto-forge-ui-brief](.agents/skills/forge-ui-brief/SKILL.md) when the task is a meaningful UI feature or redesign
- [$auto-forge-ui-qa](.agents/skills/forge-ui-qa/SKILL.md) after implementation
- [$auto-forge-ui-critic](.agents/skills/forge-ui-critic/SKILL.md) for a read-only second pass

Read only what you need:

- `references/system-contract.md`
- `references/self-review-rubric.md`

## Core Principle

Do not treat UI quality as prompt taste.

Treat UI as a system with:

- explicit tokens
- stable primitives
- layout patterns
- required states
- accessibility rules
- screenshot-verifiable outcomes

If the repository already has a design system, extend it. Do not impose a different visual language unless the user explicitly wants a redesign.

If the repository does not have a UI system, use this skill to keep the work disciplined and call out the missing repo-local UI docs as a process gap. When memory maintenance is in scope, use [$auto-forge-memory](.agents/skills/forge-memory/SKILL.md) to scaffold `docs/ui/`.

## Workflow

### 1. Read the repo’s UI truth first

Before proposing or implementing UI, inspect the UI source of truth in this order when present:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/agent-memory/*.md` relevant to product and architecture
4. `docs/ui/FRONTEND.md`
5. `docs/ui/TOKENS.md`
6. `docs/ui/PATTERNS.md`
7. `docs/ui/REFERENCE_SCREENS.md`
8. root-level `FRONTEND.md` or `DESIGN.md` only as legacy fallback when the repo has not been normalized yet
9. theme files such as `tailwind.config.*`, CSS variables, token files, theme objects, or component-library config
10. existing reusable primitives, page shells, form wrappers, tables, cards, dialogs, menus, and navigation patterns
11. Storybook stories, visual snapshots, or existing frontend test fixtures when present

Do not start from generic aesthetic assumptions if the repo already defines patterns.

### 2. Anchor the work to product behavior

For every UI task, identify:

- the user goal
- the primary action
- the critical supporting actions
- the highest-risk failure state
- the surfaces affected
- the existing primitives to reuse

If any of those are unclear, inspect the code and existing screens before inventing structure.

### 3. Enforce system rules

Default rules:

- prefer semantic tokens over raw color values
- prefer CSS variables, theme objects, or existing token files over one-off inline values
- prefer existing primitives over custom wrappers
- prefer one strong layout shell over per-section improvisation
- prefer explicit spacing and typography scales over arbitrary values
- prefer mobile-first structure and progressive enhancement
- prefer fewer visual motifs with strong repetition over many styles mixed together

Avoid:

- ad hoc color decisions
- mixing multiple card or elevation styles without a reason
- random spacing jumps
- weak hierarchy
- unlabeled controls
- UI that looks polished only in the happy path

### 4. Cover required states

Every new or materially changed UI surface should define and support the relevant subset of:

- default
- loading
- empty
- error
- success
- disabled
- overflow or long-content behavior
- mobile
- desktop

Do not ship a surface that is only visually coherent in the default state.

### 5. Keep the interface operator-grade

Aim for:

- strong hierarchy
- clear primary action
- visual economy
- stable rhythm
- predictable affordances
- credible product density

Reject:

- template-like clutter
- decorative noise without meaning
- controls that exist but do little
- inconsistent interaction patterns between similar screens
- visually loud but operationally weak layouts

### 6. Run a self-review before handing off

Before claiming UI work is complete, perform a deliberate UI pass against `references/self-review-rubric.md`.

If a browser is available, use:

- [$playwright](.agents/skills/playwright/SKILL.md) for live browser checks
- [$screenshot](.agents/skills/screenshot/SKILL.md) when system-level captures are needed

Capture evidence when:

- layout or spacing is disputed
- responsive behavior changed
- a visual regression is possible
- QA needs proof of state handling

## Output Rules

- when planning, describe reuse points, tokens, states, and acceptance screenshots
- when implementing, state which primitives and tokens you are following before editing
- when reviewing, findings come first and should distinguish system drift from surface bugs
- if the repo lacks durable UI docs, call that out and recommend repo-local `docs/ui/` files instead of relying on chat memory
- treat `docs/ui/*` as canonical and root-level UI docs as transitional fallback only
