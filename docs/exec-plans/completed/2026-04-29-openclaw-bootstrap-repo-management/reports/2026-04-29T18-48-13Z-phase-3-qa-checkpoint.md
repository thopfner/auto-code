# Phase 3 QA Checkpoint - GitHub SSH Key Manager

- stop_status: `QA_CHECKPOINT`
- phase: `30-phase-3-github-ssh-key-manager.md`
- implementation_commit_sha: `7a84524c5575de136b541efa801833b49b5876da`
- stop_report_commit_sha: `11408b03604ebac5f3c7a00c6846f0e679a82181`

## Files Changed

- `apps/api/src/server.ts`
- `packages/core/src/types.ts`
- `packages/ops/src/github-ssh-key-manager.ts`
- `packages/ops/src/index.ts`
- `tests/github-ssh-key-manager.test.ts`
- `tests/telegram-workflow-api.test.ts`
- `docs/deployment/README.md`

## Implemented Behavior

- Added a repo-scoped GitHub SSH key manager that generates Ed25519 deploy keys under `AUTO_FORGE_SSH_KEY_ROOT` or `/etc/auto-forge-controller/ssh`.
- Private keys are stored under restrictive directories and chmodded to `0600`; public keys may be shown with fingerprints.
- Added Telegram repo commands:
  - `/repo key create <alias>`
  - `/repo key show <alias>`
  - `/repo key test <alias>`
  - `/repo key github-add <alias> [--write]`
  - `/repo git-test <alias>`
- Git read validation uses `git ls-remote` with `GIT_SSH_COMMAND` pinned to the repo key.
- Push validation uses `git push --dry-run` with the repo key.
- GitHub deploy-key API registration uses `AUTO_FORGE_GITHUB_TOKEN` or `GITHUB_TOKEN` and defaults to read-only unless `--write` is explicit.
- Telegram/API responses redact private-key material from command errors and never return private keys in key output.
- Deployment docs now document the repo SSH key command flow, storage root override, read-only default, and write-access flag.

## Validation Run

- `npm run test -- --run tests/github-ssh-key-manager.test.ts`: passed, 1 file / 5 tests
- `npm run test -- --run tests/telegram-workflow-api.test.ts`: passed, 1 file / 14 tests
- `npm run test -- --run tests/github-ssh-key-manager.test.ts tests/telegram-workflow-api.test.ts`: passed, 2 files / 19 tests
- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm run verify`: passed, lint/typecheck/schema check and 17 files / 102 tests
- `npm run full-rebuild`: passed, including fresh bootstrap, verify, install-check, health, backup/restore, recovery/log discovery, Docker Compose build/up/smoke, and cleanup

## Targeted Proof

- Private-key file mode proof is covered by `tests/github-ssh-key-manager.test.ts`.
- Public key and fingerprint output proof is covered by key creation/show formatting and Telegram API response tests.
- Redaction proof covers OpenSSH private-key blocks in thrown command errors and Telegram API responses.
- Git command construction proof covers `git ls-remote`, `git push --dry-run`, and `GIT_SSH_COMMAND` key isolation with fake command runners.
- GitHub deploy-key API proof covers owner/repo parsing, bearer token use, read-only default, and explicit write access payloads with a fake fetch implementation.

## Not Run

- Live GitHub deploy-key creation was not run because no disposable repo and suitably scoped GitHub token were provided.
- Live SSH access against GitHub was not run because no real deploy key was installed on a disposable repository during this checkpoint.

## Dirty Repo Note

An unrelated untracked `tools/forge/__pycache__/` directory existed before this implementation batch and was left unmodified and uncommitted.

## Durable Memory Candidates

- Auto Forge now has repo-scoped Ed25519 SSH deploy-key management through Telegram commands.
- Deploy-key API creation defaults to read-only and requires an explicit `--write` flag for write access.
- Private SSH keys stay on controller disk and are not returned through Telegram/API responses.
- The default SSH key root is `/etc/auto-forge-controller/ssh`, overrideable with `AUTO_FORGE_SSH_KEY_ROOT`.

## QA Gate

Phase 3 is stopped at `QA_CHECKPOINT`. Do not start `40-phase-4-integration-proof.md` until QA clears this checkpoint.
