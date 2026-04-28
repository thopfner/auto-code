# Phase 5 Managed Codex CLI Revision Stop

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-28T21:53:51Z`
Stop status: `BLOCKED_EXTERNAL`

## Phase Addressed

- `64-phase-5-revision-managed-codex-cli.md`
- Execution mode: `FINAL_SHIPGATE_REVISION`
- Validation level: `FULL_REBUILD`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Implementation commit SHA: `ac13bdb34d776849f2289e05172ba7c8b7f85932`
- Stop report commit SHA: `PENDING_STOP_REPORT_COMMIT`
- Push status: pending at report creation; must be pushed after report commit.

## Files Changed

- `package.json`
- `package-lock.json`
- `packages/adapters/src/codex-binary.ts`
- `packages/adapters/src/codex-runner.ts`
- `packages/adapters/src/index.ts`
- `packages/ops/src/health.ts`
- `apps/cli/src/index.ts`
- `tests/codex-runner.test.ts`
- `tests/ops.test.ts`
- `scripts/bootstrap.sh`
- `Dockerfile`
- `.env.example`
- `docs/deployment/README.md`
- `docs/deployment/local.md`
- `docs/deployment/vps.md`
- `docs/agent-memory/CURRENT_STATE.md`
- `docs/agent-memory/TESTING.md`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/2026-04-28T21-53-51Z-phase-5-managed-codex-cli.md`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/LATEST.md`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/LATEST.json`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/automation/state.json`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/automation/qa.json`

## Managed Codex CLI Behavior Implemented

- Added `@openai/codex@0.125.0` as a normal product dependency locked in `package-lock.json`.
- Added a shared Codex CLI resolver with this order:
  1. explicit `CodexCliRunnerOptions.codexBin`
  2. explicit `CODEX_CLI_COMMAND`
  3. repo-managed `node_modules/.bin/codex`
- `CodexCliRunner` and `ops:health` use the shared resolver.
- Missing managed binary errors now tell the operator to rerun `scripts/bootstrap.sh` or rebuild the Docker image.
- Broken explicit `CODEX_CLI_COMMAND` overrides fail health closed instead of silently degrading.
- `scripts/bootstrap.sh` and `Dockerfile` assert `node_modules/.bin/codex` exists after `npm ci`.
- Fresh install docs no longer list global Codex CLI as a prerequisite; `CODEX_CLI_COMMAND` is documented only as an override.
- Codex auth behavior is unchanged: unattended live smoke still requires `OPENAI_API_KEY`.

## Required Proof

```bash
npm run verify
```

Result: passed. ESLint, TypeScript, schema check, and Vitest passed: `14` files, `56` tests.

```bash
npm run full-rebuild
```

Result: passed. Completed fresh bootstrap, verify, install-check, runtime health, references-only backup/restore, recovery dry run, task/service log discovery, Docker Compose build/up/smoke, and cleanup.

Fresh bootstrap proof:

- `scripts/bootstrap.sh` ran `npm ci`.
- Bootstrap asserted `node_modules/.bin/codex` exists.
- Host runtime health reported `/var/www/html/auto.thapi.cc/node_modules/.bin/codex codex-cli 0.125.0` with `details.source: "managed"`.

Docker/Compose proof:

- Docker build executed `RUN test -x node_modules/.bin/codex`.
- Compose smoke passed and reported Codex `codex-cli 0.125.0`.

```bash
PATH=/usr/bin:/bin npm run test -- --run tests/codex-runner.test.ts
```

Result: passed. `1` file, `3` tests. The runner test resolved `node_modules/.bin/codex` with sanitized `PATH`.

```bash
PATH=/usr/bin:/bin npm run ops:health
```

Result: passed. Health reported:

```json
{
  "name": "codex",
  "status": "passed",
  "message": "/var/www/html/auto.thapi.cc/node_modules/.bin/codex codex-cli 0.125.0",
  "details": {
    "source": "managed"
  }
}
```

`npm run live:smoke` was not run because staged/live external credentials are absent in this shell:

- `OPENCLAW_BASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_TEST_CHAT_ID`
- `OPENAI_API_KEY`

## Blockers Or Residual Risks

- No local implementation blocker remains for `64-phase-5-revision-managed-codex-cli.md`.
- Final go-live proof remains externally blocked until staged or live OpenClaw, Telegram, and OpenAI credentials are supplied and `npm run live:smoke` passes.
- Existing ignored `.env` files from earlier installs may still contain `CODEX_CLI_COMMAND=codex`; npm-run service paths still resolve the repo-managed binary through npm's local bin path, and new `.env` files now leave the override empty.

## Durable Memory Candidates

- Codex CLI is a repo-managed dependency via `@openai/codex@0.125.0`.
- Default Codex binary resolution is explicit runner option, explicit `CODEX_CLI_COMMAND`, then `node_modules/.bin/codex`.
- Fresh host and Docker installs should run `npm ci`/bootstrap/build rather than installing global Codex manually.
- Codex installation is separate from auth; `OPENAI_API_KEY` remains required for unattended live runner smoke.

## QA Status

`BLOCKED_EXTERNAL`
