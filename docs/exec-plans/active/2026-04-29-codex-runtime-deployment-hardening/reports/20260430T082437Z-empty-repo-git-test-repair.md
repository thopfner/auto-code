# Empty Repo Git Test Repair

- brief_id: `2026-04-29-codex-runtime-deployment-hardening`
- updated_at: `2026-04-30T08:24:37Z`
- stop_status: `READY_FOR_TARGET_VALIDATION`
- source_candidate_commit_sha: `8dff3d92ddaacb8850ae36a54177932ff1ead677`
- prior_phase_stop_report_commit_sha: `c25984c12e0a3b7ec99b0ac0ee127392452e5daa`
- implementation_commit_sha: `8dff3d92ddaacb8850ae36a54177932ff1ead677`
- next_authorized_phase: `30-phase-3-vps-telegram-proof.md`

## Summary

Fixed `/repo git-test` for freshly cloned empty GitHub repos that do not have a local `HEAD` commit yet.

Changes:

- `/repo git-test` now checks whether the local product repo has `HEAD`.
- When `HEAD` is missing, the deploy-key manager creates an unattached temporary empty commit object with `git commit-tree`.
- The write check then dry-runs pushing that temporary commit to the configured default branch.
- The check does not create product files, branches, real commits, or remote refs.
- The success message explicitly says the repo is empty and the initial product commit is still pending.

## Verification

Source/dev checkout validation passed:

```bash
npm test -- tests/github-ssh-key-manager.test.ts
npm run verify
```

`npm run verify` passed lint, TypeScript, schema check, and Vitest with 17 test files and 124 tests.

## Target Follow-Up

Pull `8dff3d92ddaacb8850ae36a54177932ff1ead677` into `/opt/auto-forge-controller`, rerun the installer or recreate services, then retry:

```text
/repo git-test coder-frontend
```

For an empty repo, the expected successful message is:

```text
SSH read access and dry-run push verified for empty repo coder-frontend. Initial product commit is still pending.
```
