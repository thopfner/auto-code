# Phase 5 Revision - Installer UX And Auth Polish

Execution mode: `FINAL_SHIPGATE_REVISION`
Validation level: `FULL_REBUILD`
Stop gate: `QA_CHECKPOINT`

## Why This Revision Exists

QA confirmed the one-command installer is a real deployment orchestrator and is a major improvement over the prior checklist. It now installs/verifies prerequisites, writes runtime env, aligns Compose state, starts services, and runs smoke gates.

However, two user-facing issues still block acceptance:

1. The installer runs `scripts/bootstrap.sh`, and bootstrap still prints old manual next steps telling the operator to edit `.env`, start services manually, and open onboarding. That contradicts the one-command installer while it is running.
2. The installer offers `AUTO_FORGE_CODEX_AUTH_MODE=oauth`, runs `codex login --device-auth`, but still calls setup with `--codex-auth-ref env:OPENAI_API_KEY`. This makes OAuth a false option and can leave the deployed runtime configured for an API key that the OAuth path did not collect.

## Production-Grade Acceptance Bar

The bar is inherited from `72-phase-5-revision-one-command-vps-installer.md`.

Ship-ready means the normal installer flow has one coherent set of instructions and one coherent Codex auth path. It must not print contradictory manual bootstrap guidance, and it must not offer an auth choice that writes a different auth mode into runtime config.

Forbidden shortcuts:

- Do not hide the old bootstrap message by ignoring bootstrap failures or skipping bootstrap proof.
- Do not leave `scripts/bootstrap.sh` misleading when run by the installer.
- Do not keep an OAuth prompt/path in the installer unless it writes the correct `CODEX_AUTH_REF` and reports live-smoke limitations truthfully.
- Do not weaken the setup wizard's existing standalone OAuth device-auth behavior.
- Do not remove API-key auth as the default unattended installer path.
- Do not weaken references-only setup JSON or runtime env mode `0600`.

## Blocking QA Findings To Fix

### Finding 1 - Installer Still Emits Manual Checklist Instructions

Type: `execution_miss`, `setup_ux_gap`

Evidence:

- `scripts/install-vps.sh` runs `bash "$repo_dir/scripts/bootstrap.sh"` during the one-command flow.
- `scripts/bootstrap.sh` still prints:
  - edit `.env`
  - start API/worker/web manually
  - open onboarding UI

Why this blocks:

- The phase explicitly forbids requiring the operator to run `scripts/bootstrap.sh` or manual service commands as part of the normal installer path.
- Even though the installer continues afterward, a noobie user will see contradictory instructions in the middle of the install.

Required fix:

- Add an installer-aware bootstrap mode, for example `AUTO_FORGE_BOOTSTRAP_CONTEXT=installer` or `--installer`, that keeps bootstrap checks but prints an installer-appropriate completion message.
- Update `scripts/install-vps.sh` to call bootstrap in that mode.
- Keep the current standalone local bootstrap guidance available when `scripts/bootstrap.sh` is run directly.
- Add a deterministic test proving installer dry-run or source text no longer exposes the old manual bootstrap checklist as part of the one-command installer path.

### Finding 2 - Installer OAuth Choice Writes API-Key Runtime Config

Type: `execution_miss`, `auth_contract_gap`

Evidence:

- `scripts/install-vps.sh` prompts `Codex auth mode: api-key or oauth`.
- When `oauth` is selected, it runs `node_modules/.bin/codex login --device-auth` and `login status`.
- The setup invocation still always includes `--codex-auth-ref env:OPENAI_API_KEY`.

Why this blocks:

- OAuth selection does not match the runtime setup state.
- A deployed runtime can be left configured for `env:OPENAI_API_KEY` even though the installer did not collect an API key in OAuth mode.
- The final live-smoke gate currently requires `OPENAI_API_KEY`, so the installer must either keep API-key only for the normal one-command path or explicitly handle OAuth as an advanced path with truthful limitations.

Required fix:

- Choose one coherent approach:
  - Preferred: make the one-command installer API-key only for now and remove the OAuth choice from the installer prompt, while leaving `npm run setup:vps` OAuth support intact for advanced/manual diagnostics.
  - Acceptable: keep OAuth in the installer only if it passes `--codex-auth-ref secret:codex-oauth-local-cache`, does not write `CODEX_AUTH_REF=env:OPENAI_API_KEY`, and truthfully skips or marks `npm run live:smoke` as incompatible with OAuth because that final gate currently requires `OPENAI_API_KEY`.
- Add deterministic test coverage for the selected behavior.
- Preserve existing setup wizard tests for `codex login --device-auth`.

## Required Implementation

Files to change, in order:

1. `scripts/bootstrap.sh`
   - Add installer-aware output mode or equivalent.
   - Keep standalone bootstrap behavior useful.

2. `scripts/install-vps.sh`
   - Call bootstrap in installer-aware mode.
   - Fix the Codex auth mode behavior so the installer cannot write runtime setup for a different auth mode than the operator selected.
   - Keep API-key as the default unattended path.
   - Keep dry-run output redacted.

3. `tests/vps-installer.test.ts`
   - Prove the installer path does not expose the old standalone bootstrap manual checklist.
   - Prove the selected Codex auth behavior is internally consistent.
   - Keep existing dry-run secret redaction and Compose alignment tests.

4. Docs:
   - `docs/deployment/README.md`
   - `docs/deployment/vps.md`
   - Active brief reports and automation files.

Likely no changes are needed in app runtime code unless the chosen auth fix requires a narrow setup CLI option.

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

The dry-run proof must show:

- no raw token/key leakage
- no old manual bootstrap checklist in the one-command installer path
- coherent Codex auth behavior for the selected approach

If live credentials, DNS, TLS, or OpenClaw are unavailable, stop as `BLOCKED_EXTERNAL` only after these deterministic proofs pass.

## Completion Report

Write a timestamped report under `reports/`, refresh `reports/LATEST.md`, refresh `reports/LATEST.json`, update `automation/state.json` and `automation/qa.json`, commit, push, and report:

- how bootstrap output is made installer-aware
- whether installer Codex auth is API-key only or supports OAuth coherently
- dry-run redaction proof
- tests run
- implementation commit SHA
- stop report commit SHA
- push status

## QA Gate

QA cannot accept this revision until the one-command installer presents a single coherent user journey and cannot configure a runtime auth mode that contradicts the operator's chosen Codex auth path.

