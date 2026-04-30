# Phase 2 QA Revision Required

- updated_at: `2026-04-30T11:07:26Z`
- qa_status: `REVISION_PACK_REQUIRED`
- reviewed_phase: `20-phase-2-publish-aware-retry.md`
- revision_phase: `21-phase-2-revision-publish-artifact-cleanliness.md`
- implementation_commit_sha: `5024f105322f8e967a1beb227532f74ed1cd9c85`
- stop_report_commit_sha: `dcc64b89f1bf27c83cb96a0a869e4a4bb6d4874a`
- next_authorized_phase: `21-phase-2-revision-publish-artifact-cleanliness.md`

## Findings

### P1: Successful publish retry leaves canonical artifacts dirty and not published

Classification: `execution_miss`

The Phase 2 brief required derived state to stay aligned across `automation/qa.json`, `reports/LATEST.json`, task status, task events, and Telegram messaging. The implementation pushes first, then writes success metadata into canonical artifacts, then marks the task completed.

Code evidence:

- `packages/core/src/workflow-engine.ts:495` runs `git push -u origin <defaultBranch>`.
- `packages/core/src/workflow-engine.ts:516-535` writes success fields to `automation/qa.json`, `reports/LATEST.json`, and `automation/state.json` after the push.
- `packages/core/src/workflow-engine.ts:537-555` marks the task completed and sends `Completed: local QA passed and GitHub push succeeded.`

For a normal product repo, the active brief artifacts are inside the repo. After success, the local repo can become dirty and GitHub can still contain the old failed `push_status`. That breaks the product workflow because the controller says completed while local canonical state and remote published state are no longer aligned.

Test gap:

- `tests/workflow-engine.test.ts:490` creates the publish-retry artifact root with `mkdtemp(...)`, outside the git repo.
- `tests/workflow-engine.test.ts:292-313` checks the temp artifact JSON and task completion, but does not assert that the product repo is clean or that the remote contains the success artifact update.

## Verification

```bash
npm run verify
```

Result:

- `npm run verify` passed: lint, typecheck, schema check, and 139 tests.

The green suite does not clear the phase because it misses the tracked-artifact cleanliness case above.

## Revision Pack

Revision instructions are in:

```text
docs/exec-plans/active/2026-04-30-publish-retry-durable-workflow/21-phase-2-revision-publish-artifact-cleanliness.md
```

## Durable Memory Candidates

- Publish-only retry success must leave the product repo clean and must not make local canonical artifacts diverge from the pushed remote.
