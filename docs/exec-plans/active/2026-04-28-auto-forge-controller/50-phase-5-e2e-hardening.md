# Phase 5 - End-To-End Hardening

Execution mode: `FINAL_SHIPGATE`
Validation level: `FULL_REBUILD`

## Goal

Prove go-live readiness with a complete Telegram-triggered Forge workflow.

## Required Behavior

- Fresh install path works.
- Onboarding completes.
- Telegram/OpenClaw/Codex/repo connections validate.
- `/scope` starts a real task.
- Scope, plan, worker, QA, and final closeout complete.
- Completed brief is archived.
- Memory updates happen.
- Operator receives Telegram summaries throughout.

## Required Tests

- Full automated test suite.
- Docker Compose or production-equivalent rebuild.
- Live or staged Telegram/OpenClaw smoke.
- Real Codex runner smoke.
- Full fixture repo Forge lifecycle.

## Gate

Final QA must complete `90-final-qa-and-merge-gate.md` and `99-memory-pack-update.md` before returning `CLEAR_CURRENT_PHASE`.

