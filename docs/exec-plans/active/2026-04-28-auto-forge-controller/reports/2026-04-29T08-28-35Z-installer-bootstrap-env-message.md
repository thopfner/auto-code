# Phase 5 Installer Bootstrap Env Message

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-29T08:28:35Z`
Stop status: `BLOCKED_EXTERNAL`

## Phase Addressed

- `76-phase-5-revision-installer-bootstrap-env-message.md`
- Execution mode: `FINAL_SHIPGATE_REVISION`
- Validation level: `FULL_REBUILD`
- Stop gate: `QA_CHECKPOINT`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Implementation commit SHA: `458cb0db6c118e9930c161d0686464844c03bbe1`
- Stop/report commit SHA: `pending-report-commit`

## Implementation Summary

Installer-mode bootstrap now uses context-aware missing-`.env` output:

- `scripts/bootstrap.sh` still creates `.env` from `.env.example` and applies `chmod 600`.
- Standalone bootstrap still prints `Replace secret environment values before live onboarding`.
- Installer-mode bootstrap now prints `Created .env from .env.example for installer bootstrap. The VPS installer will replace it with Compose env pointers and write runtime secret references.`
- `tests/vps-installer.test.ts` now executes `scripts/bootstrap.sh --installer` in a temporary fresh repo skeleton with no `.env`, stubs only `npm`, verifies `.env` content and `0600` mode, and rejects stale standalone/manual guidance.

No installer auth, OpenClaw, Telegram discovery, Compose alignment, or runtime setup behavior was changed.

## Missing Env Proof

Command:

```bash
tmp_dir="$(mktemp -d)"
mkdir -p "$tmp_dir/scripts" "$tmp_dir/node_modules/.bin" "$tmp_dir/fakebin"
cp scripts/bootstrap.sh "$tmp_dir/scripts/bootstrap.sh"
cp .env.example "$tmp_dir/.env.example"
printf '#!/usr/bin/env bash\nexit 0\n' > "$tmp_dir/fakebin/npm"
chmod +x "$tmp_dir/fakebin/npm"
printf '#!/usr/bin/env bash\nexit 0\n' > "$tmp_dir/node_modules/.bin/codex"
chmod +x "$tmp_dir/node_modules/.bin/codex"
cd "$tmp_dir"
PATH="$tmp_dir/fakebin:$PATH" AUTO_FORGE_BOOTSTRAP_CONTEXT=installer bash ./scripts/bootstrap.sh --installer
stat -c '%a %n' .env
```

Result: passed.

Observed output:

```text
Created .env from .env.example for installer bootstrap. The VPS installer will replace it with Compose env pointers and write runtime secret references.
Bootstrap checks complete for the VPS installer.

The installer will continue with runtime env creation, setup JSON, Docker Compose deployment, nginx/TLS when selected, and smoke checks.
600 .env
```

The stale `Replace secret environment values before live onboarding` message did not appear.

## Dry-Run Proof

Command:

```bash
AUTO_FORGE_INSTALL_DRY_RUN=1 AUTO_FORGE_PUBLIC_BASE_URL=https://forge.example.com TELEGRAM_BOT_TOKEN=redacted-test-telegram-token OPENAI_API_KEY=redacted-test-openai-key bash scripts/install-vps.sh --dry-run
```

Result: passed.

Proof checks:

- output contained `Codex auth: API key via env:OPENAI_API_KEY`
- output contained `Secret values: redacted`
- output contained the installer bootstrap and setup wizard dry-run steps
- output did not contain `redacted-test-telegram-token`
- output did not contain `redacted-test-openai-key`
- output did not contain `Edit .env`
- output did not contain `start API/worker/web`
- output did not contain `codex login --device-auth`
- output did not contain `Codex auth mode: api-key or oauth`

## Files Changed

- `scripts/bootstrap.sh`
- `tests/vps-installer.test.ts`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/2026-04-29T08-28-35Z-installer-bootstrap-env-message.md`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/LATEST.md`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/LATEST.json`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/automation/state.json`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/automation/qa.json`

## Tests And Checks Run

```bash
bash -n scripts/install-vps.sh
```

Result: passed.

```bash
bash -n scripts/bootstrap.sh
```

Result: passed.

```bash
npm run test -- --run tests/vps-installer.test.ts tests/vps-setup-wizard.test.ts
```

Result: passed. `2` files, `19` tests.

```bash
npm run verify
```

Result: passed. ESLint, TypeScript, schema check, and Vitest passed: `15` files, `66` tests.

```bash
npm run full-rebuild
```

Result: passed. Completed fresh bootstrap, verify, install-check, runtime health, references-only backup/restore, recovery dry run, task/service log discovery, Docker Compose build/up/smoke, and cleanup.

```bash
npm run live:smoke
```

Result: `BLOCKED_EXTERNAL` with exit code `2`.

Missing:

- `OPENCLAW_BASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_TEST_CHAT_ID`
- `OPENAI_API_KEY`

## Blockers Or Residual Risks

The authorized revision is implemented and deterministic validation passed. Final go-live remains externally blocked until staged or live OpenClaw, Telegram, and OpenAI credentials are provided and `npm run live:smoke` passes.

## Durable Memory Candidates

- Installer-mode bootstrap must keep output clean even when `.env` is missing and bootstrap creates it.
- Standalone bootstrap keeps local `.env` secret-edit guidance; installer-mode bootstrap explains that the installer will replace the placeholder with Compose env pointers and runtime secret references.

## Push Status

Pending until the report commit is pushed.

## QA Status

`BLOCKED_EXTERNAL`
