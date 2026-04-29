# Phase 5 Revision - Installer Bootstrap Env Message

Execution mode: `FINAL_SHIPGATE_REVISION`
Validation level: `FULL_REBUILD`
Stop gate: `QA_CHECKPOINT`

## Why This Revision Exists

QA accepted the main direction of `74-phase-5-revision-installer-ux-auth-polish.md`: the installer is now API-key only for Codex and `scripts/install-vps.sh` calls `scripts/bootstrap.sh` in installer mode.

However, one fresh-install path still leaks standalone bootstrap guidance into the one-command installer:

- When `.env` is missing, `scripts/bootstrap.sh --installer` still creates `.env` from `.env.example` and prints `Created .env from .env.example. Replace secret environment values before live onboarding.`

That is still a contradictory instruction during the noobie VPS installer path. The installer itself writes deployment pointers and runtime secrets afterward, so the operator must not be told to hand-edit `.env` before live onboarding.

## Production-Grade Acceptance Bar

The bar is inherited from `72-phase-5-revision-one-command-vps-installer.md` and `74-phase-5-revision-installer-ux-auth-polish.md`.

The one-command installer must present one coherent user journey on a fresh VPS where `.env` does not exist yet. Bootstrap may prepare local files needed for repo checks, but installer-mode output must not ask the operator to manually edit `.env`, replace secret values, run services manually, or perform OAuth/device-auth steps.

Forbidden shortcuts:

- Do not skip bootstrap from the installer.
- Do not hide bootstrap failures.
- Do not weaken `.env` file mode handling.
- Do not weaken setup JSON references-only behavior.
- Do not reintroduce installer OAuth prompts or `codex login --device-auth` in the one-command installer.
- Do not change OpenClaw, Telegram discovery, managed Codex dependency, or Docker Compose runtime env alignment unless directly required by this finding.

## Blocking QA Finding To Fix

### Finding 1 - Fresh Installer Bootstrap Still Prints Standalone Env Secret Guidance

Type: `execution_miss`, `setup_ux_gap`

Evidence:

- `scripts/bootstrap.sh` line 44 creates `.env` when missing.
- `scripts/bootstrap.sh` line 47 prints `Created .env from .env.example. Replace secret environment values before live onboarding.`
- `scripts/install-vps.sh` calls bootstrap before writing the installer-managed Compose `.env` pointers.
- QA reproduced the fresh-install path with a temporary repo skeleton and `AUTO_FORGE_BOOTSTRAP_CONTEXT=installer bash ./scripts/bootstrap.sh --installer`; output included the stale manual secret replacement message.

Why this blocks:

- The previous revision explicitly aimed to remove contradictory bootstrap/manual instructions from the normal installer path.
- A fresh VPS clone is the primary noobie launch path, and `.env` is expected to be missing there.
- The stale message tells the operator to do manual secret work that the installer is supposed to own.

Required fix:

- In `scripts/bootstrap.sh`, make the `.env` creation message context-aware.
- In standalone mode, preserve useful local bootstrap guidance.
- In installer mode, either suppress the `.env` creation message or replace it with installer-appropriate wording, for example that bootstrap prepared a local placeholder and the installer will write deployment pointers plus runtime secret references.
- Keep `chmod 600 .env` behavior for the created file.

## Required Implementation

Files to change, in order:

1. `scripts/bootstrap.sh`
   - Make the missing-`.env` creation output respect `BOOTSTRAP_CONTEXT`.
   - Ensure installer mode does not print `Replace secret environment values before live onboarding`, `Edit .env`, manual service start instructions, or OAuth/device-auth instructions.

2. `tests/vps-installer.test.ts`
   - Add a deterministic fresh-bootstrap test that executes `scripts/bootstrap.sh --installer` in a temporary repo skeleton where `.env` is absent.
   - Stub only expensive external steps such as `npm` while still proving script behavior, `.env` creation, and file mode.
   - Assert:
     - `.env` is created from `.env.example`
     - `.env` mode is `0600`
     - output contains installer-appropriate continuation text
     - output does not contain `Replace secret environment values before live onboarding`
     - output does not contain `Edit .env`
     - output does not contain `start API/worker/web`
     - output does not contain `codex login --device-auth`

3. Docs and stop artifacts
   - Update only docs that mention the affected installer/bootstrap behavior if they are stale.
   - Write the required stop report and refresh machine-readable state.

## Required Tests And Proof

Run and report:

```bash
bash -n scripts/install-vps.sh
bash -n scripts/bootstrap.sh
npm run test -- --run tests/vps-installer.test.ts tests/vps-setup-wizard.test.ts
npm run verify
npm run full-rebuild
AUTO_FORGE_INSTALL_DRY_RUN=1 AUTO_FORGE_PUBLIC_BASE_URL=https://forge.example.com TELEGRAM_BOT_TOKEN=redacted-test-telegram-token OPENAI_API_KEY=redacted-test-openai-key bash scripts/install-vps.sh --dry-run
```

Also run and report an explicit missing-env-file proof equivalent to:

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

The missing-env-file proof must show:

- `.env` is created
- `.env` mode is `600`
- no stale manual secret replacement message appears
- installer continuation text appears

If live credentials, DNS, TLS, or OpenClaw are unavailable, stop as `BLOCKED_EXTERNAL` only after these deterministic proofs pass.

## Completion Report

Write a timestamped report under `reports/`, refresh `reports/LATEST.md`, refresh `reports/LATEST.json`, update `automation/state.json` and `automation/qa.json`, commit, push, and report:

- exact bootstrap output change
- exact fresh missing-env proof command and result
- dry-run redaction/coherent-output proof
- tests run
- implementation commit SHA
- stop report commit SHA
- push status

## QA Gate

QA cannot accept this revision until installer-mode bootstrap is clean in both cases:

- `.env` already exists
- `.env` is missing and bootstrap creates it during the installer flow
