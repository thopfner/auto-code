# Phase 2 Publish-Aware Retry

- updated_at: `2026-04-30T11:02:24Z`
- stop_status: `QA_CHECKPOINT`
- implementation_commit_sha: `5024f105322f8e967a1beb227532f74ed1cd9c85`
- stop_report_commit_sha: `PENDING_LOCAL_REPORT_COMMIT`
- next_authorized_phase: `20-phase-2-publish-aware-retry.md`

## Summary

Phase 2 added publish-aware `/task retry <task-id>` handling for blocked tasks whose canonical QA artifact says local QA already cleared but GitHub publishing failed.

The workflow engine now classifies `push_failed_after_clear_qa` before normal full retry. Publish-only retry reads canonical `automation/qa.json`, requires clear QA, requires full implementation and stop-report SHAs, verifies branch, clean tree, HEAD, and commit resolution, then runs only `git push -u origin <defaultBranch>`. It does not dispatch scope, planner, worker, or QA roles.

On success, the engine records `publish_retry_started`, `publish_retry_succeeded`, and `task_completed`, marks the task completed, updates canonical `automation/qa.json`, `reports/LATEST.json`, and `automation/state.json` push metadata, and sends `Completed: local QA passed and GitHub push succeeded.` On failure, it keeps the task blocked, records `publish_retry_failed`, preserves stdout/stderr/exit-code detail, and sends remediation pointing to `/repo github-setup <alias>` and `/repo git-test <alias>`.

## Files Changed

- `packages/core/src/artifacts.ts`
- `packages/core/src/workflow-engine.ts`
- `tests/workflow-engine.test.ts`
- `tests/telegram-workflow-api.test.ts`

## Verification

```bash
npx vitest run --config vitest.config.ts tests/workflow-engine.test.ts
npx vitest run --config vitest.config.ts tests/workflow-engine.test.ts tests/telegram-workflow-api.test.ts tests/artifact-validation.test.ts
npm run verify
```

Results:

- Focused workflow test: passed, 17 tests.
- Affected workflow/API/artifact tests: passed, 45 tests.
- `npm run verify`: passed; lint, typecheck, schema check, and 139 tests passed.

## Residual Risk

- This phase validates publish retry with local Git fixtures and fake controller adapters. Live GitHub auth, branch protection, and deploy-key behavior still need target/deployed proof in later phases.
- Successful publish-only retry updates local canonical JSON artifacts after the push because this phase explicitly limits the retry command to `git push -u origin <defaultBranch>` and does not create a new product commit.

## Durable Memory Candidates

- `/task retry <task-id>` can perform a publish-only retry for clear-QA push blockers when canonical artifacts and git state prove the repo is unchanged.
- Publish-only retry preflight refuses dirty trees, branch mismatches, missing/invalid full SHAs, unresolved artifact commits, and HEAD mismatches before pushing.
