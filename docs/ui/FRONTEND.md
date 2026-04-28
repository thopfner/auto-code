# Auto Forge Controller Frontend

Last refreshed: 2026-04-28

## Product Surface

The frontend is an operator console and onboarding flow for configuring a portable Forge automation controller. It is not a marketing site.

## Required Areas

- First-run onboarding wizard.
- Connection health dashboard for Telegram, OpenClaw, Codex, DB, worker, and registered repos.
- Repo registry and user permissions.
- Runner profile configuration.
- Queue and task detail views.
- Run logs, artifact summaries, and recovery actions.
- Deployment and portability export/import flows.

## UX Direction

- Quiet, utilitarian SaaS operations interface.
- Dense enough for repeated operator use.
- Clear status hierarchy over decorative presentation.
- Strong affordances for approvals, blockers, retry, pause, resume, and cancel.

## Accessibility

- Keyboard-accessible setup and recovery flows.
- Visible focus states.
- Clear labels for all connection, secret, and destructive actions.
- Status changes must not rely only on color.

