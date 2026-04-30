# Phase 2: Publish-Aware Retry

Gate: `QA_CHECKPOINT`  
Validation level: `SERVICE_RESTART`  
Authorization: authorized after Phase 1 QA clearance

## Goal

Make `/task retry <task-id>` retry only GitHub publishing when canonical artifacts prove local QA passed and repo state is unchanged.

## Enhanced Risky Seam Inventory

- Git state safety: HEAD, branch, clean working tree, and canonical artifact SHAs must agree.
- External provider: `git push -u origin <defaultBranch>` can fail for auth, branch protection, divergence, network, or host key reasons.
- Derived state: `automation/qa.json`, `reports/LATEST.json`, task status, task events, and Telegram message must remain aligned.

## Edge-State Matrix

- `qa_status: CLEAR_CURRENT_PHASE`, push failed, clean tree, expected HEAD: run publish-only retry.
- clear QA but dirty tree: refuse automatic retry and keep task blocked.
- clear QA but HEAD differs from accepted stop report SHA: refuse automatic retry and ask operator to rerun or inspect.
- missing canonical QA artifact: refuse automatic retry.
- push succeeds: update artifacts, record event, mark task completed, send completed message.
- push fails: preserve blocked status and exact push error with remediation.
- blocker is not publish-related: full retry remains available only for supported classifications.

## Owned Paths

- `packages/core/src/workflow-engine.ts`
- `packages/core/src/artifacts.ts`
- `packages/core/src/types.ts` if task metadata fields are added
- `packages/core/src/workflow-store.ts` and `packages/db/src/postgres-workflow-store.ts` if retry metadata is persisted as structured fields
- `apps/api/src/server.ts`
- `tests/workflow-engine.test.ts`
- `tests/artifact-validation.test.ts`
- `tests/telegram-workflow-api.test.ts`

## Required Implementation

- Add a retry classifier that identifies `push_failed_after_clear_qa`.
- Read canonical `automation/qa.json` from the product repo active brief.
- Require full 40-character `implementation_commit_sha` and `stop_report_commit_sha`.
- Verify current branch and `git rev-parse HEAD`.
- Verify `git status --short` is clean before publish-only retry.
- Retry only `git push -u origin <defaultBranch>`.
- On success:
  - update `automation/qa.json` push status to succeeded
  - update `reports/LATEST.json` if present
  - append `publish_retry_started` and `publish_retry_succeeded`
  - mark task completed
  - send `Completed: local QA passed and GitHub push succeeded.`
- On failure:
  - append `publish_retry_failed`
  - leave task blocked
  - preserve exact stderr/stdout summary
  - send remediation that points to `/repo github-setup <alias>` and `/repo git-test <alias>` when appropriate

## Required Proof

Source tests must prove:

- clear QA plus failed push is retryable
- publish-only retry does not dispatch scope/planner/worker/QA
- successful publish retry completes the task
- failed publish retry keeps the task blocked with exact reason
- dirty tree or changed HEAD refuses publish-only retry

Run:

```bash
npm run verify
```

## Stop Gate

Stop for external QA after committing and pushing Phase 2.
