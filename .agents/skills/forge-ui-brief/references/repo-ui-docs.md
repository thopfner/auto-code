# Repo-Local UI Docs

These files make UI standards durable across planner, worker, and QA sessions.

## Minimum recommended docs

- `docs/ui/FRONTEND.md`
  - frontend stack
  - rendering model
  - routing conventions
  - state-management rules
  - accessibility expectations

- `docs/ui/TOKENS.md`
  - semantic color tokens
  - spacing scale
  - typography scale
  - radius and elevation rules
  - motion and transition rules if applicable

- `docs/ui/PATTERNS.md`
  - page shells
  - card patterns
  - forms
  - tables
  - tabs
  - modal and drawer usage
  - empty and error states

- `docs/ui/REFERENCE_SCREENS.md`
  - canonical screens or component combinations that represent the desired product quality
  - notes about what each screen does well

## Optional but high-value

- Storybook stories for core primitives and states
- Playwright visual baselines for core journeys
- a frontend quality score or cleanup tracker

## Rule

- `docs/ui/` is the canonical location for durable UI memory.
- Root-level `FRONTEND.md` or `DESIGN.md` should be treated as legacy fallback; prefer linking or migrating them into `docs/ui/`.
- If a UI convention matters across more than one task, it should live in the repo, not only in a prompt.
