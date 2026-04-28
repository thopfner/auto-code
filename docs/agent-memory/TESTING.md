# Auto Forge Controller Testing Memory

Last refreshed: 2026-04-28

## Fast Checks

- `git status --short`
- `npm run lint`
- `npm run typecheck`
- `npm run schema:check`
- `npm run test`
- `npm run verify`

## Phase 1 Verification

Run from `/var/www/html/auto.thapi.cc`:

```bash
npm run verify
```

`npm run verify` runs ESLint, TypeScript typechecking, SQL migration schema checks, and Vitest unit tests for the state machine, repo locks, fake runner/operator adapters, and config validation.

## Phase 2 Verification

Run from `/var/www/html/auto.thapi.cc`:

```bash
npm run verify
```

Phase 2 also supports a lightweight live reload smoke:

```bash
PORT=3100 npm run dev:api
VITE_API_BASE_URL=http://127.0.0.1:3100 npm run dev:web -- --host 127.0.0.1 --port 5174
```

QA verified API health, Telegram command metadata, setup status, and Vite serving the onboarding app. Live OpenClaw/Telegram validation still requires credentials.

## Phase 3 Verification

Run from `/var/www/html/auto.thapi.cc`:

```bash
npm run verify
```

Phase 3 revision QA verified:

- `npm run verify` passes ESLint, TypeScript, schema check, and Vitest with 11 files and 38 tests.
- `CodexCliRunner.run()` works with installed `codex-cli 0.125.0` using `codex exec --config approval_policy="..."`.
- The real Codex runner smoke was executed in read-only mode and returned `AUTO_FORGE_QA_SMOKE_OK`.
- Artifact validation enforces full 40-character implementation and stop-report commit SHAs.
- Artifact QA status mapping covers `CLEAR_CURRENT_PHASE`, `REVISION_PACK_REQUIRED`, `REPLAN_REQUIRED`, and `BLOCKED_EXTERNAL`.
- API service smoke passed on `/health`, `/setup`, and `/setup/telegram-commands`.
- Worker service smoke started `auto-forge-worker` with runner `codex-cli`.

## Full Verification

The final product must provide a single documented verification command or script that runs:

- formatting or lint checks
- type checks
- unit tests
- integration tests for controller state transitions
- OpenClaw webhook contract tests
- Codex runner adapter smoke tests with a fake runner and at least one real local smoke path
- web onboarding UI tests
- Docker Compose or deployment smoke checks

## Runtime QA

Final shipgate must prove:

- fresh local install
- fresh VPS-style install
- OpenClaw gateway health
- Telegram command registration or documented BotFather setup
- `/scope` intake from Telegram
- scope clarification pause and resume
- planning approval pause and resume
- worker execution to QA stop
- QA revision or clearance path
- final closeout archive and memory update

## Test Data And Fixtures

- Use a disposable fixture repo for end-to-end tests.
- Use fake Telegram/OpenClaw/Codex adapters for deterministic CI.
- Use one real OpenClaw/Codex smoke run before declaring go-live readiness.

## Known Gaps

- Runtime integration checks are not implemented yet.
- Real OpenClaw and Telegram smoke tests are deferred to later phases.
