# Phase 2 Revision: Publish Artifact Cleanliness

Gate: `QA_CHECKPOINT`  
Validation level: `SERVICE_RESTART`  
Authorization: authorized now after Phase 2 QA found an implementation miss

## Source Finding

Phase 2 publish-only retry updates canonical artifacts after `git push -u origin <defaultBranch>` succeeds:

- `packages/core/src/workflow-engine.ts` writes `automation/qa.json`, `reports/LATEST.json`, and `automation/state.json` after the push.
- It then marks the task completed without committing or publishing those artifact changes.

For normal product repos, those files live under the repo active brief path. If tracked, the success path leaves the product worktree dirty and remote GitHub still contains the pre-retry `push_status` failure. That violates the Phase 2 risky seam: derived state, canonical artifacts, task status, and published repo state must remain aligned.

The current tests miss this because the publish-retry fixture stores artifacts in a temp directory outside the git repo.

## Goal

Make successful publish-only retry leave the product repo in a clean, truthful, published state.

## Owned Files

- `packages/core/src/workflow-engine.ts`
- `tests/workflow-engine.test.ts`
- `tests/telegram-workflow-api.test.ts` if API-level coverage needs the same fixture correction
- `docs/exec-plans/active/2026-04-30-publish-retry-durable-workflow/**`

## Required Implementation

1. Move the publish-success artifact updates before the final publishing operation, or otherwise ensure they are included in a commit that is pushed.
2. Preserve the Phase 2 invariant that publish-only retry does not rerun scope, planner, worker, or QA.
3. Preserve the Phase 2 preflight checks:
   - canonical QA status is clear
   - full 40-character implementation and stop-report SHAs exist
   - current branch matches `repo.defaultBranch`
   - `git rev-parse HEAD` matches the accepted stop-report SHA before making publish-retry changes
   - the worktree is clean before making publish-retry changes
4. When publish retry succeeds, leave the product repo worktree clean.
5. Ensure the pushed remote contains the success artifact update, not only the previously blocked commit.
6. Preserve failure behavior:
   - if push fails before success metadata can be published, keep the task blocked
   - preserve exact git stdout/stderr/exit-code detail
   - keep remediation pointing to `/repo github-setup <alias>` and `/repo git-test <alias>`
7. Do not broaden this revision into worker queue ownership, GitHub onboarding, or full retry redesign.

## Required Test Changes

Update the publish-retry fixtures so canonical artifacts live inside the product repo active brief path, not outside the repo. At minimum, add or change tests to prove:

- successful publish-only retry leaves `git status --short` empty
- the bare remote or pushed branch contains the success artifact update after retry
- publish-only retry still does not dispatch scope/planner/worker/QA
- failed push still leaves the task blocked with exact output and actionable remediation
- dirty tree and changed HEAD refusal tests still pass

## Required Verification

```bash
npx vitest run --config vitest.config.ts tests/workflow-engine.test.ts
npx vitest run --config vitest.config.ts tests/workflow-engine.test.ts tests/telegram-workflow-api.test.ts tests/artifact-validation.test.ts
npm run verify
```

## Stop Gate

Stop for external QA after committing and pushing the revision. The stop report must identify:

- implementation commit SHA
- stop/report commit SHA
- exact tests run
- whether successful publish retry leaves the repo clean
- whether the pushed remote contains the success artifact update
