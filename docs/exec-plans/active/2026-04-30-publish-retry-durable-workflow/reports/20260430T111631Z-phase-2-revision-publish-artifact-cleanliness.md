# Phase 2 Revision: Publish Artifact Cleanliness

- updated_at: `2026-04-30T11:16:31Z`
- stop_status: `QA_CHECKPOINT`
- reviewed_phase: `21-phase-2-revision-publish-artifact-cleanliness.md`
- implementation_commit_sha: `04b50c028cb1fa824f24c61a6108fe4904aba9b2`
- stop_report_commit_sha: `PENDING`
- next_authorized_phase: `21-phase-2-revision-publish-artifact-cleanliness.md`

## Summary

The publish-only retry success path now writes success metadata into canonical artifacts before publishing, builds a dedicated artifact-success commit with `git commit-tree`, pushes that commit to `origin/<defaultBranch>`, then advances the local branch with `git reset --soft <publishCommitSha>` only after the push succeeds.

The retry still refuses unsafe state before making publish changes: canonical QA must be clear, full implementation and stop-report SHAs must exist and resolve, the branch must match the repo default branch, `HEAD` must match the accepted stop-report SHA, and the worktree must be clean. Scope, planner, worker, and QA runners are still not dispatched for publish-only retry.

If the final push fails, the task remains blocked with exact git stdout/stderr/exit-code detail and the same `/repo github-setup <alias>` plus `/repo git-test <alias>` remediation. The attempted success artifact changes are restored locally before returning the blocked task.

## Files Changed

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

## Artifact Cleanliness Proof

- Successful publish-only retry leaves `git status --short` empty in the product repo fixture.
- The pushed bare remote branch contains the success artifact update at `docs/exec-plans/active/publish-retry-fixture/automation/qa.json` with `push_status: pushed to origin/main` and `publish_retry_status: succeeded`.
- Publish-only retry still records no scope/planner/worker/QA runner requests.
- Failed push restores the pre-retry canonical `push_status: failed: auth denied` and keeps the task blocked with exact git output and actionable GitHub remediation.

## Residual Risk

- This revision proves the artifact publish semantics with local Git fixtures and fake controller adapters. Live GitHub deploy-key, branch protection, and target-install proof remain later external validation.

## Durable Memory Candidates

- Publish-only retry success must publish canonical success artifacts in the same pushed product-repo commit that completes the retry, then leave the product worktree clean.
