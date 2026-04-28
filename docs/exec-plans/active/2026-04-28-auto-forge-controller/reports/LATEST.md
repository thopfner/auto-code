# Phase 3 QA Review - Revision Required

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-28T14:52:56Z`
Stop status: `REVISION_PACK_REQUIRED`

## Phase Reviewed

- `30-phase-3-codex-forge-engine.md`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Reviewed implementation commit SHA: `25aa4f30b1e81169395015b3d16c64af32d670fc`
- Worker stop report commit SHA: `be8e29bdfee4209a1623957bbaa4d04a1799e733`
- Current pushed HEAD during QA: `eb5477505555af8f6dc1426b87b8a6cc40ae564a`

## Findings

### 1. `CodexCliRunner.run()` uses an unsupported Codex CLI approval flag

Type: `execution_miss`

Phase 3 requires the Codex runner adapter and a real Codex smoke path. The runner currently builds `codex exec` arguments with `--ask-for-approval` in `packages/adapters/src/codex-runner.ts`. The installed Codex CLI for user `tyler` is `codex-cli 0.125.0`, and it rejects that flag before a run starts.

Required revision:

- Update `CodexCliRunner` to use the current Codex CLI invocation contract for `codex exec`.
- Add a regression test or smoke helper that exercises `CodexCliRunner.run()` argument construction through an executable fake CLI, not only `codex --version` and `codex exec --help`.
- Re-run one real Codex CLI smoke path using the corrected runner path, with read-only sandboxing and no repo mutation.

### 2. The workflow engine disables required commit-SHA enforcement when deriving QA outcome from artifacts

Type: `execution_miss`

Phase 3 explicitly requires the artifact watcher to verify the report files, automation JSON, branch, full SHAs, and push status. The validator supports required SHA enforcement, but `ForgeWorkflowEngine.outcomeFromArtifacts()` calls it with `requireCommitShas: false`, so incomplete machine artifacts can still drive a QA outcome.

Required revision:

- Make the engine's artifact-derived QA outcome path enforce required commit SHAs.
- Add a workflow-level test proving missing or short machine-readable SHAs block the task instead of allowing a stale clear outcome.

### 3. Artifact QA outcome mapping does not recognize the repo's revision-pack status

Type: `execution_miss`

The artifact watcher maps `REVISION_REQUIRED` to the internal `revision` outcome, but this brief and QA workflow use `REVISION_PACK_REQUIRED`. If a QA artifact writes the current status vocabulary, the workflow engine routes the task to blocked instead of the revision loop.

Required revision:

- Update artifact QA status mapping to recognize the repo's actual machine-readable stop statuses, including `REVISION_PACK_REQUIRED`.
- Add validator and workflow tests proving the revision-pack artifact status routes back to worker revision.

### 4. Machine-readable Phase 3 QA metadata was stale during the worker stop

Type: `brief-local`

At the Phase 3 worker stop, `automation/qa.json` still pointed to the Phase 2 clearance. This QA pass has refreshed the active automation state to `REVISION_PACK_REQUIRED`, but the worker should ensure future phase stops update `automation/qa.json` and `automation/state.json` consistently with the latest report.

## Verification Run By QA

```bash
npm run verify
```

Result: passed. ESLint, TypeScript, schema check, and Vitest passed: 11 files, 31 tests.

Additional QA checks confirmed `codex-cli 0.125.0` is installed and the current branch `main` is pushed at `eb5477505555af8f6dc1426b87b8a6cc40ae564a`.

## Required Next Stop

Return to QA after the Codex runner invocation is corrected, artifact-derived QA outcome enforces required machine-readable SHAs, tests cover the corrected failure modes, service-scoped runtime smoke is repeated, and refreshed report and automation artifacts are pushed.

## QA Status

`REVISION_PACK_REQUIRED`
