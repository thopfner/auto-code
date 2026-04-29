# Phase 5 One-Command VPS Installer

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-29T07:48:11Z`
Stop status: `BLOCKED_EXTERNAL`

## Phase Addressed

- `72-phase-5-revision-one-command-vps-installer.md`
- Execution mode: `FINAL_SHIPGATE_REVISION`
- Validation level: `FULL_REBUILD`
- Stop gate: `QA_CHECKPOINT`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Implementation commit SHA: `0e0ce32a98036f83f5818dd9913de678887e326f`
- Stop/report commit SHA: pending until this report commit is created

## Installer Command Supported

Primary fresh-VPS command:

```bash
curl -fsSL https://raw.githubusercontent.com/thopfner/auto-code/main/scripts/install-vps.sh | sudo bash
```

Repo-local command:

```bash
sudo bash scripts/install-vps.sh
```

The repo-local package shortcut is also available:

```bash
npm run install:vps
```

## Deployment Path Automated

The installer now owns the normal VPS path end to end:

- verifies Ubuntu and root privileges for mutating installs
- installs or verifies base prerequisites
- installs Node.js 24/npm 11 when host Node is missing or too old
- installs Docker Engine and the Compose plugin from Docker's official Ubuntu apt repo when missing
- clones or updates the repo when invoked through curl-pipe, or uses the local checkout when run from the repo
- runs bootstrap internally
- runs setup with the installer runtime env file and Compose-compatible setup paths
- builds and starts Postgres, API, worker, and web through Docker Compose
- installs/reloads nginx when selected
- optionally installs Certbot and requests HTTPS when selected
- runs Compose health/smoke and then the live external smoke gate

## Rerun And Idempotency

Reruns preserve existing host state:

- existing Git checkouts are updated with `git pull --ff-only`
- existing Docker/nginx installations are reused
- setup writes only the managed env block and preserves mode `0600`
- setup JSON is written to the Compose data bind mount and services read it as `/data/setup.json`
- nginx refuses a conflicting non-Auto-Forge managed site instead of overwriting it

## Runtime Env And Compose State

The installer default runtime env file is `/etc/auto-forge-controller/auto-forge.env`. The setup writer creates it with mode `0600`, and the installer re-applies `chmod 0600` after setup.

Compose now reads the installer runtime env through `AUTO_FORGE_RUNTIME_ENV_FILE`, defaults to `.env` for local/full-rebuild paths, and bind-mounts `AUTO_FORGE_HOST_DATA_DIR` to `/data`. The installer writes host setup JSON to:

```text
/opt/auto-forge-controller/.auto-forge/compose-data/setup.json
```

Containers read the same file as:

```text
/data/setup.json
```

The Compose file no longer hardcodes deploy-time public URL, OpenClaw, Telegram, or Codex auth values over the runtime env file.

## Secret Handling Proof

Dry-run proof command:

```bash
AUTO_FORGE_INSTALL_DRY_RUN=1 AUTO_FORGE_PUBLIC_BASE_URL=https://forge.example.com TELEGRAM_BOT_TOKEN=redacted-test-telegram-token OPENAI_API_KEY=redacted-test-openai-key bash scripts/install-vps.sh --dry-run
```

Result: passed. Output contained `Secret values: redacted` and did not contain `redacted-test-telegram-token` or `redacted-test-openai-key`.

Setup JSON remains references-only through the existing `buildControllerSetup` and `FileSetupStore` path. Non-interactive setup can now write raw env values from `env:` references into the runtime env file while persisting only secret references in setup JSON.

## Files Changed

- `.env.example`
- `apps/cli/src/index.ts`
- `docker-compose.yml`
- `docker-compose.smoke.yml`
- `docs/deployment/README.md`
- `docs/deployment/vps.md`
- `package.json`
- `packages/ops/src/install-check.ts`
- `packages/ops/src/vps-setup.ts`
- `scripts/configure-nginx.sh`
- `scripts/install-vps.sh`
- `tests/vps-installer.test.ts`

## Tests And Checks Run

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

Result: passed. ESLint, TypeScript, schema check, and Vitest passed: `15` files, `63` tests.

```bash
npm run full-rebuild
```

Result: passed. Completed fresh bootstrap, verify, install-check, runtime health, references-only backup/restore, recovery dry run, task/service log discovery, Docker Compose build/up/smoke, and cleanup.

```bash
npm run live:smoke
```

Result: `BLOCKED_EXTERNAL`.

Missing:

- `OPENCLAW_BASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_TEST_CHAT_ID`
- `OPENAI_API_KEY`

## Blockers Or Residual Risks

Live go-live remains externally blocked until staged or live OpenClaw, Telegram, and OpenAI credentials are provided and `npm run live:smoke` passes. DNS/TLS was not executed in this shell; the installer path is implemented and dry-run covered, but real Certbot issuance requires a live domain pointed at the VPS.

## Durable Memory Candidates

- Fresh VPS launch now has a one-command installer at `scripts/install-vps.sh`.
- The installer default runtime env file is `/etc/auto-forge-controller/auto-forge.env`, mode `0600`.
- Docker Compose consumes the installer runtime env via `AUTO_FORGE_RUNTIME_ENV_FILE` and uses a host data bind mount for `/data/setup.json`.
- Setup JSON remains references-only; raw Telegram/OpenAI values live only in the ignored runtime env file.

## Push Status

Pending until the report commit is created and pushed.

## QA Status

`BLOCKED_EXTERNAL`
