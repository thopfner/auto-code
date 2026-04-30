# Durable Workflow Store And Task Retry Repair

- updated_at: `2026-04-30T10:08:52Z`
- stop_status: `READY_FOR_TARGET_VALIDATION`
- source_candidate_commit_sha: `8c1354c62703ace3046575fecdaa39bac4bb50b7`
- prior_phase_stop_report_commit_sha: `d2dfdbd9e0bbd931096cd39346471cb729eaed5a`
- implementation_commit_sha: `8c1354c62703ace3046575fecdaa39bac4bb50b7`
- next_authorized_phase: `30-phase-3-vps-telegram-proof.md`

## Objective

Fix the production path where product repo registration, active repo selection, and task state were lost on service restart or redeploy because the API still used `MemoryWorkflowStore`. Add a first-class retry path so an operator can retry a blocked task from Telegram/API after fixing credentials or runtime configuration.

## Changes

- Added `PostgresWorkflowStore` backed by `pg.Pool` and the existing workflow schema.
- Extended the SQL migration and schema table list with `active_repo_selections` and `repo_events`.
- Wired `buildServer()` to use `PostgresWorkflowStore` automatically when `DATABASE_URL` is present and no explicit test store is injected.
- Preserved memory store behavior for deterministic unit tests and local harnesses without `DATABASE_URL`.
- Added a `retry` state-machine event from `blocked` to `queued`, clearing stale blocker/run/approval fields.
- Added `ForgeWorkflowEngine.retryTask()` to retry the same task ID through a fresh scope-to-QA run and emit `task_retry_requested`.
- Added `/workflow/tasks/:taskId/retry` and Telegram `/task retry <task-id> [reason]`.
- Registered `/task` in the Telegram command catalog.

## Verification

Ran from `/var/www/html/auto.thapi.cc`:

```bash
npm run typecheck
npm run schema:check
npm run test -- tests/state-machine.test.ts tests/workflow-engine.test.ts tests/telegram-workflow-api.test.ts
npm run lint
npm run verify
```

Results:

- `npm run schema:check` passed for 11 tables.
- Focused retry/store command tests passed: 3 files, 35 tests.
- Full `npm run verify` passed: 17 files, 130 tests.

## Target Validation Required

After this commit is pulled into `/opt/auto-forge-controller`, restart/recreate the target services and validate that repo state persists through another restart:

```bash
cd /opt/auto-forge-controller
git status --short
git rev-parse HEAD
npm install
npm run verify
docker compose build
docker compose up -d postgres api worker web
```

Then from Telegram:

```text
/repos
/repo add-path coder-frontend /data/repos/coder-frontend
/repo use coder-frontend
/repos
```

Restart services and confirm `/repos` still shows `coder-frontend` as the selected product repo. If a blocked task exists after fixing the blocker, retry it with:

```text
/task retry <task-id>
```

## Remaining Blockers

- Existing in-memory registrations from the old process cannot be recovered after a restart unless they were also recorded elsewhere. Register each product repo once after deploying this durable-store repair; subsequent restarts should preserve them in Postgres.
- Production readiness still requires target VPS Telegram, GitHub deploy-key, `/repo git-test`, and real product `/scope` smoke after pulling the source commit.
