# GitHub Onboarding Repair

- brief_id: `2026-04-29-codex-runtime-deployment-hardening`
- updated_at: `2026-04-30T07:28:32Z`
- stop_status: `READY_FOR_TARGET_VALIDATION`
- source_candidate_commit_sha: `75f264a0acc9b1dbc687f5c9eb542162d2a7eb0a`
- prior_phase_stop_report_commit_sha: `19cf717f9272a3b0f9803391df48256e6a00307e`
- implementation_commit_sha: `75f264a0acc9b1dbc687f5c9eb542162d2a7eb0a`
- next_authorized_phase: `30-phase-3-vps-telegram-proof.md`

## Summary

Implemented the Telegram-managed GitHub onboarding repair after the deployed README smoke reached mounted worktree execution but blocked at push readiness.

Changes:

- Added `/repo github-setup <alias>` to return a safe step-by-step deploy-key onboarding path from Telegram.
- Improved `/repo key ...` and `/repo git-test ...` failures so missing keys, missing GitHub API token, or failed push dry-runs point operators at `/repo github-setup`, `/repo key create`, `/repo key github-add --write`, and `/repo git-test`.
- Kept Telegram output limited to public key and fingerprint material; private keys and tokens remain server-side only.
- Converted GitHub HTTPS remotes to `git@github.com:owner/repo.git` for SSH deploy-key read checks and push dry-runs.
- Preserved already configured SSH host-alias remotes such as `git@github-auto-forge:owner/repo.git` instead of forcing them through GitHub URL parsing.
- Updated artifact validation so task-specific QA JSON under active-brief automation can override stale canonical `automation/qa.json` for the matching task id.
- Replaced generic artifact-derived QA blocking with a concrete validation summary and GitHub push-readiness next steps when applicable.
- Updated durable memory where the old HTTPS-remote deploy-key testing limitation was no longer true.

## Verification

Source/dev checkout validation passed:

```bash
npm test -- tests/artifact-validation.test.ts tests/workflow-engine.test.ts tests/github-ssh-key-manager.test.ts tests/telegram-workflow-api.test.ts
npm run typecheck
npm run verify
```

`npm run verify` passed lint, TypeScript, schema check, and Vitest with 17 test files and 121 tests.

## Target Follow-Up

Pull `75f264a0acc9b1dbc687f5c9eb542162d2a7eb0a` into `/opt/auto-forge-controller`, rerun the installer or recreate the services, then test from Telegram:

```text
/repo github-setup default-repo
/repo key create default-repo
/repo git-test default-repo
```

After adding the deploy key to GitHub with write access, `/repo git-test default-repo` should verify SSH read access and a write dry-run. Then rerun the README `/scope` task and confirm it no longer ends with a generic `QA blocked the task` for GitHub onboarding state.
