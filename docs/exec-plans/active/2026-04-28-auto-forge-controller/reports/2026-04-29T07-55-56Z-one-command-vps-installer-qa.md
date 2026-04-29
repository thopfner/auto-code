# Phase 5 One-Command VPS Installer QA

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-29T07:55:56Z`
Stop status: `REVISION_PACK_REQUIRED`

## Phase Reviewed

- `72-phase-5-revision-one-command-vps-installer.md`
- Execution mode: `FINAL_SHIPGATE_REVISION`
- Validation level: `FULL_REBUILD`

## Findings

### 1. Installer Still Emits Manual Bootstrap Instructions

Severity: blocking
Type: `execution_miss`, `setup_ux_gap`

The one-command installer invokes `scripts/bootstrap.sh`, but bootstrap still prints standalone manual next steps telling the operator to edit `.env`, start API/worker/web manually, and open onboarding. That output appears in the middle of the installer flow and contradicts the product promise that the operator should not manually run bootstrap/service commands.

The phase brief explicitly forbids requiring the operator to run `scripts/bootstrap.sh` or manual service commands as part of the normal install path.

### 2. Installer OAuth Choice Writes API-Key Runtime Config

Severity: blocking
Type: `execution_miss`, `auth_contract_gap`

The installer prompts for `api-key or oauth` and runs `codex login --device-auth` when OAuth is selected, but `run_setup_wizard()` always passes `--codex-auth-ref env:OPENAI_API_KEY`. This can leave runtime setup configured for an API key even though the installer did not collect one in OAuth mode.

The phase brief required a coherent Codex auth path with API-key default and no regression of device-auth behavior.

### 3. Stop Metadata Uses Placeholder Commit IDs

Severity: brief-local repairable
Type: `truthfulness_gap`

`reports/LATEST.json`, `automation/state.json`, and `automation/qa.json` recorded `pending-report-commit` even though the worker report commit exists as `852255f202c31f656053e15021a100c5d5a1ab53`.

This is report-local drift. The next revision pack supersedes these artifacts, so QA is re-authorizing the next revision rather than asking for an implementation-only restop.

## Positive QA Notes

The implementation is materially more user-friendly and closer to end-to-end:

- `scripts/install-vps.sh` is a real installer, not a command-printing wrapper.
- It supports curl-pipe and repo-local execution.
- It installs/verifies prerequisites, Docker Engine, Compose plugin, nginx, and Certbot when selected.
- It writes runtime env to `/etc/auto-forge-controller/auto-forge.env`.
- It aligns Compose with installer runtime env and `/data/setup.json`.
- It runs Compose build/up/smoke and the live external smoke gate.
- Dry-run output redacts supplied raw secret values.

## QA Verification Run

```bash
bash -n scripts/install-vps.sh
```

Result: passed.

```bash
npm run test -- --run tests/vps-installer.test.ts tests/vps-setup-wizard.test.ts
```

Result: passed. `2` files, `16` tests.

```bash
npm run verify
```

Result: passed. `15` files, `63` tests.

```bash
npm run full-rebuild
```

Result: passed. Completed fresh bootstrap, verify, install-check, runtime health, references-only backup/restore, recovery dry run, task/service log discovery, Docker Compose build/up/smoke, and cleanup.

```bash
AUTO_FORGE_INSTALL_DRY_RUN=1 AUTO_FORGE_PUBLIC_BASE_URL=https://forge.example.com TELEGRAM_BOT_TOKEN=redacted-test-telegram-token OPENAI_API_KEY=redacted-test-openai-key bash scripts/install-vps.sh --dry-run
```

Result: passed for secret redaction; output did not contain `redacted-test-telegram-token` or `redacted-test-openai-key`.

```bash
npm run live:smoke
```

Result: `BLOCKED_EXTERNAL`.

Missing:

- `OPENCLAW_BASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_TEST_CHAT_ID`
- `OPENAI_API_KEY`

## Revision Pack Delivered

- `74-phase-5-revision-installer-ux-auth-polish.md`
- `75-installer-ux-auth-polish-worker-handoff.md`

## QA Status

`REVISION_PACK_REQUIRED`

