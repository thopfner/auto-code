# UI System And Reuse Plan

## System Direction

Build a restrained SaaS operations console. Use semantic tokens and reusable primitives from the first frontend commit.

## Required Primitives

- App shell.
- Setup stepper.
- Status row.
- Connection card.
- Data table.
- Detail drawer or split pane.
- Log viewer.
- Approval panel.
- Inline alert.
- Modal confirmation.

## No-Drift Rules

- Do not create separate visual languages for onboarding and dashboard.
- Do not use raw one-off colors when semantic tokens exist.
- Do not ship default-only UI without loading, empty, error, disabled, overflow, mobile, and desktop states.

