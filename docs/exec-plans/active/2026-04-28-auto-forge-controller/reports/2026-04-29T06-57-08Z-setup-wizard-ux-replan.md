# Phase 5 Setup Wizard UX Replan

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-29T06:57:08Z`
Stop status: `READY_FOR_IMPLEMENTATION`

## Phase Authorized

- `68-phase-5-revision-setup-wizard-ux-smoothing.md`
- Execution mode: `FINAL_SHIPGATE_REVISION`
- Validation level: `FULL_REBUILD`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Current pushed HEAD before this replan: `1b331df8169ebba9bd97325bcb4b95029bc71024`

## Why This Replan Exists

Fresh launch testing found two setup UX blockers:

- Telegram chat discovery forces a full setup rerun when no chats are found.
- Codex OAuth requires a magic `I UNDERSTAND` prompt and uses the wrong login flow for remote/headless machines.

These behaviors conflict with the target browser/chat onboarding model and must be corrected before final shipgate.

## Planning Artifacts Added

- `66-setup-wizard-ux-problem-framing.md`
- `67-setup-wizard-ux-options-and-recommendation.md`
- `68-phase-5-revision-setup-wizard-ux-smoothing.md`
- `69-setup-wizard-ux-worker-handoff.md`

## Recommended Direction

Implement the recommended setup-helper path:

- make Telegram discovery retryable in-place
- allow manual chat ID fallback from the same flow
- replace `codex login` with managed `codex login --device-auth`
- remove all `I UNDERSTAND` prompt behavior
- keep API-key auth as the default unattended path

## Required Validation For The Worker

```bash
npm run verify
npm run full-rebuild
npm run test -- --run tests/vps-setup-wizard.test.ts
rg -n "I UNDERSTAND|codex login(\\s|$)|--device-auth|Telegram getUpdates returned no chats|rerun setup" apps/cli/src/index.ts docs/deployment tests
```

If live credentials are unavailable, the worker may stop as `BLOCKED_EXTERNAL` only after those commands pass.

## QA Status

`READY_FOR_IMPLEMENTATION`
