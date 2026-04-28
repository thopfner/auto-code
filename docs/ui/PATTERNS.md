# Auto Forge Controller UI Patterns

Last refreshed: 2026-04-28

## Layout

- Use an app shell with persistent navigation after onboarding.
- Onboarding should be a guided setup flow with resumable progress.
- Operational views should prefer tables, split panes, and detail drawers over marketing-style cards.

## Components

- Connection status rows for Telegram, OpenClaw, Codex, database, worker, and repos.
- Repo queue table with task state, lock state, active run, and next required action.
- Task timeline with scope, plan, worker, QA, revision, and final closeout events.
- Log viewer with search, copy, download, and redaction cues.
- Approval panels with exact decision text and consequences.

## Required States

Every important surface must cover loading, empty, error, success, disabled, long-content, mobile, and desktop behavior.

## Destructive Actions

Pause, cancel, delete, reset, and credential rotation actions require explicit confirmation and must show expected impact.

