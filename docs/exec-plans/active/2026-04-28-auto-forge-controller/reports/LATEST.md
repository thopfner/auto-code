# QA - Installer Bootstrap Env Message

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-29T08:20:21Z`
Stop status: `REVISION_PACK_REQUIRED`

## Findings

### 1. Fresh installer bootstrap still prints standalone `.env` secret guidance

Severity: `blocking`

Type: `execution_miss`, `setup_ux_gap`

Evidence:

- `scripts/bootstrap.sh:44` creates `.env` when missing.
- `scripts/bootstrap.sh:47` still prints `Created .env from .env.example. Replace secret environment values before live onboarding.`
- `scripts/install-vps.sh` calls bootstrap before the installer writes its managed Compose `.env` pointers.
- QA reproduced a fresh installer-mode bootstrap in a temporary repo skeleton with `.env` absent. The command output included the stale manual secret replacement message before the installer continuation text.

Why this blocks:

- `74-phase-5-revision-installer-ux-auth-polish.md` required the installer path to stop exposing contradictory bootstrap/manual instructions.
- A fresh VPS clone is the primary launch path and will commonly have no `.env`.
- The one-command installer is supposed to own runtime env creation and setup JSON references; the operator should not be told to manually replace `.env` secrets mid-install.

## Accepted Coverage

QA accepts the parts of the latest implementation that:

- make `scripts/install-vps.sh` call bootstrap in installer mode
- keep standalone bootstrap guidance available when bootstrap is run directly
- make the one-command installer API-key only for Codex
- preserve `npm run setup:vps` as the advanced OAuth/device-auth diagnostic path
- keep dry-run token redaction and setup JSON references-only behavior covered by tests

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

Result: passed. `2` files, `18` tests.

```bash
AUTO_FORGE_INSTALL_DRY_RUN=1 AUTO_FORGE_PUBLIC_BASE_URL=https://forge.example.com TELEGRAM_BOT_TOKEN=redacted-test-telegram-token OPENAI_API_KEY=redacted-test-openai-key bash scripts/install-vps.sh --dry-run
```

Result: passed for the existing dry-run path. Output redacted secrets and did not contain `codex login --device-auth`, `Codex auth mode: api-key or oauth`, or the old standalone checklist. This proof does not exercise missing-`.env` bootstrap creation because dry-run skips executing bootstrap.

```bash
tmp_dir=$(mktemp -d); mkdir -p "$tmp_dir/scripts" "$tmp_dir/node_modules/.bin" "$tmp_dir/fakebin"; cp scripts/bootstrap.sh "$tmp_dir/scripts/bootstrap.sh"; cp .env.example "$tmp_dir/.env.example"; printf '#!/usr/bin/env bash\nexit 0\n' > "$tmp_dir/fakebin/npm"; chmod +x "$tmp_dir/fakebin/npm"; printf '#!/usr/bin/env bash\nexit 0\n' > "$tmp_dir/node_modules/.bin/codex"; chmod +x "$tmp_dir/node_modules/.bin/codex"; cd "$tmp_dir" && PATH="$tmp_dir/fakebin:$PATH" AUTO_FORGE_BOOTSTRAP_CONTEXT=installer bash ./scripts/bootstrap.sh --installer
```

Result: failed acceptance. Output included:

```text
Created .env from .env.example. Replace secret environment values before live onboarding.
```

```bash
npm run verify
```

Result: passed. ESLint, TypeScript, schema check, and Vitest passed: `15` files, `65` tests.

`npm run full-rebuild` was not rerun by QA after this blocking fresh-install finding was confirmed. The worker report says it passed before QA found this missing path.

## Revision Pack Authored

- `76-phase-5-revision-installer-bootstrap-env-message.md`
- `77-installer-bootstrap-env-message-worker-handoff.md`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Reviewed implementation commit SHA: `f32255186011386113c231799d0b6d06e24fa51c`
- Prior worker report commit SHA: `c3b7ff73882fd0aa4e316bc5222910f07b7cadc8`
- Prior metadata stamp commit SHA: `20f3723f6036e4a0a72cd6fab42a9b332ff15efd`
- QA revision-pack commit SHA: `e6d5160720c511d9eac4d51a997c573b8ac8b2b6`

## Durable Memory Candidates

- The one-command installer must keep installer-mode bootstrap output clean even when `.env` is missing and bootstrap creates it.
- Final shipgate memory should distinguish standalone bootstrap guidance from installer-mode bootstrap guidance.

## QA Status

`REVISION_PACK_REQUIRED`
