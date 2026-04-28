# Phase 5 E2E Hardening Stop

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-28T18:25:26Z`
Stop status: `BLOCKED_EXTERNAL`

## Phase Addressed

- `50-phase-5-e2e-hardening.md`
- Execution mode: `FINAL_SHIPGATE`
- Validation level: `FULL_REBUILD`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Implementation commit SHA: `8fdd6aba6e7adfe8277283aa89e3750f86c479ba`
- Stop report commit SHA: `f13e162c9279f2b7d1c15851bed885ca47644555`
- Push status at metadata stamp: pending push of `main` after stop metadata commit

## Files Changed

- `package.json`
- `apps/cli/src/index.ts`
- `packages/ops/src/install-check.ts`
- `tests/e2e-hardening.test.ts`
- `tools/full-rebuild.ts`
- `tools/live-external-smoke.ts`
- `README.md`
- `docs/deployment/README.md`
- `docs/deployment/local.md`
- `docs/deployment/vps.md`
- `docs/agent-memory/CURRENT_STATE.md`
- `docs/agent-memory/SESSION_HANDOFF.md`
- `docs/agent-memory/TESTING.md`

## Implementation Summary

- Added deterministic Phase 5 E2E coverage for install documentation, onboarding validation, Telegram `/scope` intake, clarification pause/resume, planning approval pause/resume, worker execution, QA revision loop, final completion, operator summaries, and pushed fixture repo artifact validation.
- Added `npm run full-rebuild` to run bootstrap, `verify`, install-check, health, references-only backup/restore, recovery, task and service log discovery, Docker Compose build/up/smoke, and cleanup.
- Added `npm run live:smoke` to validate staged or live Telegram, OpenClaw, and Codex runner paths, with explicit `BLOCKED_EXTERNAL` output when required credentials are missing.
- Documented the Phase 5 verification commands and refreshed current-state/testing handoff facts.

## Verification Run

```bash
npm run verify
```

Result: passed. ESLint, TypeScript, schema check, and Vitest passed: 13 files, 44 tests.

```bash
npm run ops:install-check
```

Result: passed. The install surface now verifies `ops:health`, `ops:backup`, `full-rebuild`, and `live:smoke`.

```bash
npm run full-rebuild
```

Result: passed. Completed:

- fresh bootstrap with `scripts/bootstrap.sh`
- `npm run verify`
- install-check
- runtime health
- references-only backup and restore dry run
- recovery dry run
- task log discovery
- service log discovery for API, worker, web, and Postgres
- Docker Compose build
- Docker Compose up for Postgres/API/worker/web
- Docker Compose smoke
- Docker Compose cleanup

Compose smoke reported API and web as passed through service DNS, database as passed, and worker heartbeat as passed. Codex in the container reported degraded because the image does not include a `codex` binary; the host-level Codex CLI smoke passed in `npm run verify` with `codex-cli 0.125.0`.

```bash
npm run live:smoke
```

Result: blocked externally. Output status: `BLOCKED_EXTERNAL`.

Missing requirements:

- `OPENCLAW_BASE_URL`
- `OPENCLAW_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_TEST_CHAT_ID`
- `OPENAI_API_KEY`

## Proof Coverage

- Fresh install path: proved by `scripts/bootstrap.sh` inside `npm run full-rebuild`.
- Onboarding: proved by deterministic `/setup` validation and persistence in `tests/e2e-hardening.test.ts`.
- Telegram/OpenClaw validation: proved with fake adapters in automated E2E; live/staged validation is blocked by missing credentials.
- Codex validation: host Codex CLI smoke passed; real authenticated runner path is blocked by missing `OPENAI_API_KEY`.
- Repo validation: pushed disposable fixture repo validated by `validateForgeArtifacts` with required full 40-character SHAs and remote containment.
- `/scope` intake: proved through `POST /telegram/command`.
- Scope/plan/worker/QA/final closeout lifecycle: proved through clarification approval, planning approval, worker run, QA revision loop, worker revision, QA clear, and completed task.
- Operator summaries: proved by queued, role-start, QA revision, and completed messages in `FakeOperatorGateway`.
- Fixture repo Forge lifecycle: proved by pushed fixture repo artifacts under the QA artifact root.

## Blocker

Live or staged Telegram/OpenClaw/Codex smoke cannot run in this shell because required external credentials are absent.

Required before QA can clear Phase 5:

1. Export `OPENCLAW_BASE_URL` for the staged or live OpenClaw gateway.
2. Export `OPENCLAW_TOKEN` with permission for OpenClaw health and Telegram delivery.
3. Export `TELEGRAM_BOT_TOKEN` with permission for `getMe`, `setMyCommands`, and `sendMessage`.
4. Export `TELEGRAM_TEST_CHAT_ID` for the staged or live operator chat.
5. Export `OPENAI_API_KEY` for `CODEX_AUTH_REF=env:OPENAI_API_KEY`.
6. Rerun `npm run live:smoke`.

## Durable Memory Updates Performed

- `docs/agent-memory/TESTING.md` now documents `npm run full-rebuild` and `npm run live:smoke`.
- `docs/agent-memory/CURRENT_STATE.md` records Phase 5 local proof and the external credential blocker.
- `docs/agent-memory/SESSION_HANDOFF.md` points the next agent at live-smoke unblock and final QA.

## Durable Memory Candidates

- If final QA accepts this implementation after live-smoke credentials are provided, record the final go-live evidence and any credential-specific operational limits in the memory pack.
- If Codex must be available inside the Compose image for production, add it as a future hardening decision; the current Compose controller smoke passes without it.

## QA Status

`BLOCKED_EXTERNAL`
