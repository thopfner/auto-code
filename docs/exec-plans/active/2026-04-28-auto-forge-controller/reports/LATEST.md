# QA - Installer Bootstrap Env Message Accepted

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-29T08:36:11Z`
Stop status: `BLOCKED_EXTERNAL`

## Findings

No implementation blockers found for `76-phase-5-revision-installer-bootstrap-env-message.md`.

The fresh missing-`.env` installer bootstrap path now behaves correctly:

- `.env` is created from `.env.example`
- `.env` mode is `600`
- installer-mode continuation text appears
- stale standalone guidance does not appear
- the one-command installer still avoids OAuth/device-auth prompts and raw secret output

## Report-Local Repair

QA found report-local drift after the worker metadata stamp:

- `reports/LATEST.md` still said push status was pending.
- `reports/LATEST.*` and `automation/*.json` pointed `stop_report_commit_sha` at the pre-stamp report commit `f967bc65ecc181addb46091bd347c27a9d33f0fa`.
- The pushed metadata-stamp HEAD before this QA repair was `e4e70d1f0782be636ef720e007e343dfde8085e5`.

This was brief-local/report-local drift only. The implementation commit remains accepted as `458cb0db6c118e9930c161d0686464844c03bbe1`.

## QA Commands Run

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

Observed output included:

```text
Created .env from .env.example for installer bootstrap. The VPS installer will replace it with Compose env pointers and write runtime secret references.
Bootstrap checks complete for the VPS installer.
600 .env
```

The output did not contain `Replace secret environment values before live onboarding`.

```bash
AUTO_FORGE_INSTALL_DRY_RUN=1 AUTO_FORGE_PUBLIC_BASE_URL=https://forge.example.com TELEGRAM_BOT_TOKEN=redacted-test-telegram-token OPENAI_API_KEY=redacted-test-openai-key bash scripts/install-vps.sh --dry-run
```

Result: passed. Output contained redacted installer steps and did not contain the supplied token/key values, `Edit .env`, `start API/worker/web`, `codex login --device-auth`, or `Codex auth mode: api-key or oauth`.

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

## Accepted Coverage

- `installer_bootstrap_missing_env_message`
- `installer_bootstrap_context`
- `installer_api_key_only_codex_auth`
- `installer_dry_run_secret_redaction`
- `installer_runtime_env_mode_0600`
- `setup_json_references_only`
- `compose_installer_runtime_env_alignment`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Accepted implementation commit SHA: `458cb0db6c118e9930c161d0686464844c03bbe1`
- Worker report commit SHA: `f967bc65ecc181addb46091bd347c27a9d33f0fa`
- Worker metadata stamp commit SHA: `e4e70d1f0782be636ef720e007e343dfde8085e5`
- QA report commit SHA: `7564f37504c7cb4575a41e6db7e47f3e911de694`

## Durable Memory Candidates

- Installer-mode bootstrap keeps output clean even when `.env` is missing and bootstrap creates it.
- Standalone bootstrap keeps local `.env` secret-edit guidance.
- Installer-mode bootstrap explains that the installer will replace the placeholder with Compose env pointers and runtime secret references.
- Final closeout remains blocked until live OpenClaw, Telegram, and OpenAI credentials are available and `npm run live:smoke` passes.

## Next Authorized Window

`90-final-qa-and-merge-gate.md` remains blocked on external credentials.

## QA Status

`BLOCKED_EXTERNAL`
