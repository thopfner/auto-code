# Phase 5 Installer UX And Auth Polish

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-29T08:07:46Z`
Stop status: `BLOCKED_EXTERNAL`

## Phase Addressed

- `74-phase-5-revision-installer-ux-auth-polish.md`
- Execution mode: `FINAL_SHIPGATE_REVISION`
- Validation level: `FULL_REBUILD`
- Stop gate: `QA_CHECKPOINT`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Implementation commit SHA: `f32255186011386113c231799d0b6d06e24fa51c`
- Stop/report commit SHA: `c3b7ff73882fd0aa4e316bc5222910f07b7cadc8`

## Implementation Summary

The one-command installer now presents one coherent VPS journey:

- `scripts/bootstrap.sh` accepts `--installer` and `AUTO_FORGE_BOOTSTRAP_CONTEXT=installer`, preserving the standalone local bootstrap checklist while printing installer-appropriate continuation text when called by the VPS installer.
- `scripts/install-vps.sh` calls bootstrap in installer mode, keeps Codex API-key auth as the only one-command installer path, logs `Codex auth: API key via env:OPENAI_API_KEY`, and refuses non-API-key installer auth with an actionable setup-wizard diagnostic path.
- `npm run setup:vps` still owns the advanced OAuth device-auth flow for trusted locked-down diagnostic machines.
- Deployment docs now describe API-key-only Codex auth for the installer and keep OAuth scoped to standalone setup diagnostics.

## Dry-Run Proof

Command:

```bash
AUTO_FORGE_INSTALL_DRY_RUN=1 AUTO_FORGE_PUBLIC_BASE_URL=https://forge.example.com TELEGRAM_BOT_TOKEN=redacted-test-telegram-token OPENAI_API_KEY=redacted-test-openai-key bash scripts/install-vps.sh --dry-run
```

Result: passed.

Proof checks:

- output contained `Install directory: /opt/auto-forge-controller`
- output contained `Runtime env file: /etc/auto-forge-controller/auto-forge.env`
- output contained `Codex auth: API key via env:OPENAI_API_KEY`
- output contained `Secret values: redacted`
- output contained the installer bootstrap and setup wizard dry-run steps
- output did not contain `redacted-test-telegram-token`
- output did not contain `redacted-test-openai-key`
- output did not contain the old `Edit .env` bootstrap checklist
- output did not contain `codex login --device-auth`
- output did not contain `Codex auth mode: api-key or oauth`

## Files Changed

- `scripts/bootstrap.sh`
- `scripts/install-vps.sh`
- `tests/vps-installer.test.ts`
- `docs/deployment/README.md`
- `docs/deployment/vps.md`

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

Result: passed. `2` files, `18` tests.

```bash
npm run verify
```

Result: passed. ESLint, TypeScript, schema check, and Vitest passed: `15` files, `65` tests.

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

Live go-live remains externally blocked until staged or live OpenClaw, Telegram, and OpenAI credentials are provided and `npm run live:smoke` passes. DNS/TLS was not executed in this shell; the deterministic installer path and dry-run proof passed, but real Certbot issuance still requires a live domain pointed at the VPS.

## Durable Memory Candidates

- The VPS installer calls bootstrap in installer-aware mode so normal installer output no longer includes standalone manual bootstrap instructions.
- The one-command VPS installer is API-key only for Codex and writes setup for `CODEX_AUTH_REF=env:OPENAI_API_KEY`.
- OAuth device auth remains available through `npm run setup:vps` for trusted diagnostic machines, not as the unattended VPS installer path.

## Push Status

Pending until the metadata stamp commit is pushed.

## QA Status

`BLOCKED_EXTERNAL`
