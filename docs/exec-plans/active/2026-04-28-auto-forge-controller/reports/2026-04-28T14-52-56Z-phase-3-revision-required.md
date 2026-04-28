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

Evidence:

```bash
printf "Reply with OK only. Do not inspect or modify files." | codex exec --json --color never --sandbox read-only --ask-for-approval never --output-last-message /tmp/auto-forge-codex-smoke-last-message.md --cd /var/www/html/auto.thapi.cc -
```

Result:

```text
error: unexpected argument '--ask-for-approval' found
```

Required revision:

- Update `CodexCliRunner` to use the current Codex CLI invocation contract for `codex exec`.
- Add a regression test or smoke helper that exercises `CodexCliRunner.run()` argument construction through an executable fake CLI, not only `codex --version` and `codex exec --help`.
- Re-run one real Codex CLI smoke path using the corrected runner path, with read-only sandboxing and no repo mutation.

Relevant files:

- `packages/adapters/src/codex-runner.ts`
- `tests/codex-runner.test.ts`

### 2. The workflow engine disables required commit-SHA enforcement when deriving QA outcome from artifacts

Type: `execution_miss`

Phase 3 explicitly requires the artifact watcher to verify `reports/LATEST.md`, `reports/LATEST.json`, `automation/state.json`, `automation/qa.json`, branch, full SHAs, and push status when present. The validator supports required SHA enforcement, but `ForgeWorkflowEngine.outcomeFromArtifacts()` calls it with `requireCommitShas: false`, so incomplete machine artifacts can still drive a QA outcome.

Live proof from this repo:

```bash
npx tsx -e 'import { validateForgeArtifacts } from "./packages/core/src/artifacts.ts"; void validateForgeArtifacts({ repoPath: process.cwd(), artifactRoot: "docs/exec-plans/active/2026-04-28-auto-forge-controller", expectedBranch: "main", requireCommitShas: true }).then((s) => console.log(JSON.stringify(s, null, 2)));'
```

Result:

```text
"ok": false
"errors": ["automation/state.json is missing stop_report_commit_sha"]
```

Required revision:

- Make the engine's artifact-derived QA outcome path enforce required commit SHAs.
- Add a workflow-level test proving missing or short machine-readable SHAs block the task instead of allowing a stale clear outcome.
- Keep direct artifact validator tests for valid artifacts and short-SHA rejection.

Relevant files:

- `packages/core/src/workflow-engine.ts`
- `packages/core/src/artifacts.ts`
- `tests/workflow-engine.test.ts`
- `tests/artifact-validation.test.ts`

### 3. Artifact QA outcome mapping does not recognize the repo's revision-pack status

Type: `execution_miss`

The artifact watcher maps `REVISION_REQUIRED` to the internal `revision` outcome, but this brief and QA workflow use `REVISION_PACK_REQUIRED`. If a QA artifact writes the current status vocabulary, `qaOutcomeFrom()` returns `unknown`, and the workflow engine routes the task to blocked instead of the revision loop.

Required revision:

- Update artifact QA status mapping to recognize the repo's actual machine-readable stop statuses, including `REVISION_PACK_REQUIRED`.
- Add direct artifact validator coverage for `CLEAR_CURRENT_PHASE`, `REVISION_PACK_REQUIRED`, `REPLAN_REQUIRED`, and blocked statuses used by this brief.
- Add a workflow-level test proving a `REVISION_PACK_REQUIRED` artifact routes back to worker revision.

Relevant files:

- `packages/core/src/artifacts.ts`
- `tests/artifact-validation.test.ts`
- `tests/workflow-engine.test.ts`

### 4. Machine-readable Phase 3 QA metadata was stale during the worker stop

Type: `brief-local`

At the Phase 3 worker stop, `automation/qa.json` still pointed to the Phase 2 clearance. This QA pass has refreshed the active automation state to `REVISION_PACK_REQUIRED`, but the worker should ensure future phase stops update `automation/qa.json` and `automation/state.json` consistently with the latest report.

Required revision:

- After fixing the implementation issues above, refresh `reports/LATEST.md`, `reports/LATEST.json`, `automation/state.json`, and `automation/qa.json` together.
- Ensure every machine-readable commit SHA is a full 40-character SHA.

## Verification Run By QA

```bash
npm run verify
```

Result: passed.

Summary:

- ESLint passed.
- TypeScript passed.
- Schema check passed for 9 tables.
- Vitest passed: 11 files, 31 tests.

Additional QA checks:

```bash
codex --version
codex exec --help
```

Result: `codex-cli 0.125.0` is installed for user `tyler`.

```bash
git status --short --branch
git rev-parse HEAD origin/main
```

Result: branch `main`, pushed HEAD `eb5477505555af8f6dc1426b87b8a6cc40ae564a`.

## Required Next Stop

Return to QA after:

- the Codex runner invocation is corrected and proven through the real runner path,
- artifact-derived QA outcome enforces required machine-readable SHAs,
- tests cover the corrected failure modes,
- `npm run verify` passes,
- service-scoped runtime smoke is repeated,
- report and automation artifacts are refreshed and pushed.

## QA Status

`REVISION_PACK_REQUIRED`
