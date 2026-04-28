# Phase 5 Managed Codex CLI Replan

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-28T21:39:54Z`
Stop status: `READY_FOR_IMPLEMENTATION`

## Phase Authorized

- `64-phase-5-revision-managed-codex-cli.md`
- Execution mode: `FINAL_SHIPGATE_REVISION`
- Validation level: `FULL_REBUILD`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Current pushed HEAD before this replan: `76f3a82cb3c6b5d6953a8f36e34c8a53f7122499`

## Why This Replan Exists

Launch testing on a fresh server failed because `codex` was not globally installed. The product model does not allow requiring customers to install Codex manually through SSH or CLI. Auto Forge must install and resolve Codex as part of its own bootstrap/build process.

## Planning Artifacts Added

- `62-managed-codex-cli-problem-framing.md`
- `63-managed-codex-cli-options-and-recommendation.md`
- `64-phase-5-revision-managed-codex-cli.md`
- `65-managed-codex-cli-worker-handoff.md`

## Recommended Direction

Implement the recommended repo-managed dependency path:

- add `@openai/codex@0.125.0` as a normal product dependency
- resolve explicit overrides first, then repo-local `node_modules/.bin/codex`
- update runner, health, docs, tests, Docker, and memory to stop treating global Codex as a prerequisite
- keep `OPENAI_API_KEY` as the unattended auth requirement

## Required Validation For The Worker

```bash
npm run verify
npm run full-rebuild
PATH=/usr/bin:/bin npm run test -- --run tests/codex-runner.test.ts
PATH=/usr/bin:/bin npm run ops:health
```

If live credentials are unavailable, the worker may stop as `BLOCKED_EXTERNAL` only after those commands pass.

## QA Status

`READY_FOR_IMPLEMENTATION`
