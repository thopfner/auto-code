# Phase 3 Revision QA Checkpoint

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-28T15:02:34Z`
Stop status: `QA_CHECKPOINT`

## Phase Addressed

- `30-phase-3-codex-forge-engine.md` revision only

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`

## Implementation Summary

- Corrected `CodexCliRunner.run()` for installed `codex-cli 0.125.0` by replacing the unsupported `--ask-for-approval` flag with the current `--config approval_policy="..."` invocation path.
- Added a regression test that executes `CodexCliRunner.run()` through an executable fake Codex CLI and fails if the obsolete approval flag is emitted.
- Made artifact-derived QA outcomes enforce required machine-readable commit SHAs before routing clear, revision, replan, or blocked outcomes.
- Mapped `REVISION_PACK_REQUIRED` to the internal `revision` outcome and `BLOCKED_EXTERNAL` to `blocked`.
- Added direct artifact validator coverage for current brief QA status vocabulary and workflow-level tests for SHA enforcement and revision-pack routing.

## Files Changed

- `packages/adapters/src/codex-runner.ts`
- `packages/adapters/src/fake-runner.ts`
- `packages/core/src/artifacts.ts`
- `packages/core/src/workflow-engine.ts`
- `tests/artifact-validation.test.ts`
- `tests/codex-runner.test.ts`
- `tests/workflow-engine.test.ts`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/README.md`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/automation/qa.json`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/automation/state.json`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/LATEST.json`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/LATEST.md`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/2026-04-28T15-02-34Z-phase-3-revision-qa-checkpoint.md`

## Tests And Checks Run

npm run test -- codex-runner artifact-validation workflow-engine
npm run typecheck
npm run verify
npx tsx -e '<CodexCliRunner.run() read-only smoke>'
PORT=3197 npm run dev:api
curl -fsS http://127.0.0.1:3197/health
curl -fsS http://127.0.0.1:3197/setup
curl -fsS http://127.0.0.1:3197/setup/telegram-commands
npm run dev:worker
```

Result: passed.

Verified checks:

- Targeted Vitest run passed: 3 files, 17 tests.
- `npm run verify` passed: ESLint, TypeScript, schema check, and Vitest passed with 11 files and 38 tests.
- Real read-only Codex runner smoke passed through `CodexCliRunner.run()` with installed `codex-cli 0.125.0`; last message was `AUTO_FORGE_CODEX_RUNNER_SMOKE_OK`, artifact root `/tmp/auto-forge-real-codex-runner-yppVtk`.
- API runtime smoke passed on port `3197`: `/health`, `/setup`, and `/setup/telegram-commands` responded successfully.
- Worker runtime smoke passed: `npm run dev:worker` started `auto-forge-worker` with runner `codex-cli`.

## Commits

- Implementation commit SHA: `04478f77ad83f842ed03603adc6320a127206f35`
- Stop report commit SHA: `dae9742deac8ae70bc4f7e59727c46ac35a7742b`

## Push Status

- Pushed to `origin/main`.

## Blockers Or Residual Risks

- No Phase 4 work was started.
- Live Telegram/OpenClaw delivery remains a later-phase credentialed validation item.
- The real Codex smoke was intentionally read-only and did not exercise repo mutation.

## Durable Memory Candidates

- Codex CLI execution for Phase 3 now uses `codex exec --config approval_policy="..."` rather than the removed `--ask-for-approval` flag.
- Artifact-derived workflow QA routing now requires full machine-readable implementation and stop-report commit SHAs.
- Current QA artifact status vocabulary includes `REVISION_PACK_REQUIRED` for revision-loop routing.
