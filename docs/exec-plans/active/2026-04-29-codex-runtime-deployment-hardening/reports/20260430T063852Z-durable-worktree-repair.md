# Durable Worktree Runtime Repair - Source Ready For Target Validation

- stop_status: `READY_FOR_TARGET_VALIDATION`
- reviewed_phase: `30-phase-3-vps-telegram-proof.md`
- branch: `main`
- implementation_commit_sha: `a34077b886c8f99738194ad2933797737e9c4d27`
- source_candidate_commit_sha: `a34077b886c8f99738194ad2933797737e9c4d27`
- prior_phase_stop_report_commit_sha: `f765ccb5d1052bb2392ad768c6befdb9a42ad4ae`
- target_install_path: `/opt/auto-forge-controller`
- updated_at: `2026-04-30T06:38:52Z`
- next_authorized_phase: `30-phase-3-vps-telegram-proof.md`

## Summary

This repair addresses the latest Telegram run where Codex could execute commands, but worked inside the container overlay at `/app` instead of a durable host git worktree.

Changes:

- Docker image now installs `git` and `openssh-client` alongside CA certificates.
- Compose mounts the host default repo into API, worker, and smoke containers at `/workspace/default`.
- Compose sets `AUTO_FORGE_REPO_PATH=/workspace/default` and `AUTO_FORGE_ALLOWED_REPO_ROOTS=/workspace,/data/repos` for runtime services.
- Installer project `.env` now writes `AUTO_FORGE_DEFAULT_REPO_PATH=$INSTALL_DIR`, so the target checkout is mounted as the default worktree.
- Runner failure classification now distinguishes missing git and non-git worktree failures from missing Codex CLI failures.

## Validation Completed

```bash
npm run test -- --run tests/codex-runner.test.ts tests/vps-installer.test.ts tests/vps-setup-wizard.test.ts tests/telegram-workflow-api.test.ts
npm run verify
AUTO_FORGE_HOST_DATA_DIR=/tmp/auto-forge-tooling-proof AUTO_FORGE_API_PORT=3304 AUTO_FORGE_WEB_PORT=5577 docker compose build api worker smoke
docker compose config | rg -n "AUTO_FORGE_REPO_PATH|AUTO_FORGE_ALLOWED_REPO_ROOTS|/workspace/default|AUTO_FORGE_DEFAULT_REPO_PATH|AUTO_FORGE_CODEX_SANDBOX" -C 1
```

Observed:

- Targeted tests passed: 57 tests.
- Full verification passed: 17 files, 117 tests.
- Docker build passed and installed `git` plus `openssh-client`.
- Compose config maps the host checkout to `/workspace/default` and sets the container repo path to that mounted worktree.

## Target Validation Required

Deploy on the target checkout:

```bash
cd /opt/auto-forge-controller
git pull --ff-only
sudo bash scripts/install-vps.sh
```

Then verify inside the containers:

```bash
docker compose exec -T api sh -lc 'command -v git && git -C /workspace/default rev-parse --is-inside-work-tree && git -C /workspace/default status --short'
docker compose exec -T worker sh -lc 'command -v git && git -C /workspace/default rev-parse --is-inside-work-tree && git -C /workspace/default status --short'
docker compose exec -T api npm run ops:health
docker compose exec -T worker npm run ops:health
```

Then rerun the Telegram product workflow smoke:

```text
/scope @auto-forge-controller write a README document for this repo
```

Expected:

- Prompts should target `Repo path: /workspace/default`, not `/app`.
- Codex should be able to run `git`.
- README changes should appear in the host checkout, not only in the container overlay.
- Any remaining blocker should no longer claim `Codex CLI is unavailable` for missing git or missing `.git`.

## Remaining Production Blockers Outside This Repair

- API workflow state still uses `MemoryWorkflowStore`; durable Postgres-backed workflow state remains a production blocker.
- Worker service still does not own durable queue consumption; real queue processing and recovery remain a production blocker.
