# Phase 5 Revision - One-Command VPS Installer

Execution mode: `FINAL_SHIPGATE_REVISION`
Validation level: `FULL_REBUILD`
Stop gate: `QA_CHECKPOINT`

## Why This Revision Exists

Fresh launch testing showed that the current deployment path still expects the operator to understand and run low-level infrastructure commands. That is unacceptable for the product target.

The launch flow must be one guided installer that automates prerequisite installation, runtime env handling, Docker Compose deployment, nginx/TLS setup, and smoke checks.

## Production-Grade Acceptance Bar

The bar comes from repo conventions, current launch feedback, and primary-source deployment guidance from Docker Compose, Docker Engine Ubuntu install docs, and Certbot nginx docs.

Ship-ready means:

- a fresh Ubuntu VPS can run one installer command from GitHub or from a cloned repo
- the installer can install missing prerequisites needed for the supported Docker Compose deployment path
- the installer creates and maintains the runtime env file with mode `0600`
- the installer writes setup JSON as references-only
- Docker Compose services consume the same runtime env/setup artifacts created by the installer
- the installer builds/starts Postgres, API, worker, and web without the user manually running Docker commands
- the installer can install nginx config and optionally obtain HTTPS with Certbot when DNS is ready
- the installer runs deterministic health/smoke checks and reports one clear final status
- rerunning the installer is safe and resumable
- docs expose the one-command path as the primary VPS install path

Forbidden shortcuts:

- Do not ship a script that only prints the old manual commands.
- Do not require the operator to run `chmod`, `docker compose`, `scripts/bootstrap.sh`, `scripts/configure-nginx.sh`, `npm run full-rebuild`, or `npm run live:smoke` manually as part of the normal install path.
- Do not require host-global Codex.
- Do not require host Node/npm for the Docker Compose deployment path unless the script installs and manages that prerequisite itself.
- Do not leave Compose hardcoded env values that override the runtime env file written by setup.
- Do not store raw secrets in setup JSON, nginx config, reports, docs, Git-tracked files, or backup bundles.

## Required UX

Primary command after this revision:

```bash
curl -fsSL https://raw.githubusercontent.com/thopfner/auto-code/main/scripts/install-vps.sh | sudo bash
```

Supported local command:

```bash
sudo bash scripts/install-vps.sh
```

The installer must ask only for product-level inputs:

- install directory, default `/opt/auto-forge-controller`
- public domain/base URL
- whether to configure nginx
- whether to enable HTTPS through Certbot
- OpenClaw mode/connection choice
- Telegram bot token
- Telegram chat ID discovery/manual fallback
- Codex auth, defaulting to API key

It must perform infrastructure work itself:

- install or verify required system tools
- clone/update the repo when invoked remotely
- install Docker Engine and Docker Compose plugin if absent on Ubuntu
- build the controller image
- run setup with the correct runtime env file and Compose setup path
- set env file mode to `0600`
- start Compose services
- install/reload nginx when selected
- run Certbot when selected and DNS is ready
- run health/smoke checks

## Required Implementation

Files to change, in order:

1. `scripts/install-vps.sh`
   - Add the one-command installer.
   - Support both curl-pipe execution and repo-local execution.
   - Default repo URL to `https://github.com/thopfner/auto-code.git`.
   - Default install directory to `/opt/auto-forge-controller`.
   - Default runtime env file to `/etc/auto-forge-controller/auto-forge.env`.
   - Support `--dry-run`/`AUTO_FORGE_INSTALL_DRY_RUN=1` that prints planned actions without mutating host state.
   - Support non-interactive inputs through env vars for test automation, but keep guided prompts for normal use.
   - Refuse unsupported OSes with an actionable message rather than guessing.
   - Make every mutating step idempotent.
   - Never echo raw secret values.

2. `docker-compose.yml`
   - Align Compose with installer-created runtime env.
   - Stop hardcoding deploy-time values that should come from the runtime env file.
   - Preserve local/full-rebuild defaults.
   - Ensure API, worker, web, and smoke use the same env/source of truth.
   - Ensure setup path for services is compatible with the installer-run setup path.

3. `apps/cli/src/index.ts` and/or `packages/ops/src/vps-setup.ts`
   - Add only the CLI/helper changes needed for installer orchestration.
   - Preserve the existing setup wizard retry/manual Telegram behavior.
   - Preserve Codex `login --device-auth` OAuth behavior.
   - Preserve API-key default for unattended automation.
   - Preserve OpenClaw fail-closed behavior unless the operator explicitly chooses configure-later.

4. `scripts/bootstrap.sh` and `scripts/configure-nginx.sh`
   - Adjust only if needed so they remain usable internally and manually.
   - Do not leave them as required normal user steps.

5. `package.json`
   - Add a customer-facing script such as `deploy:vps` or `install:vps` only if it improves repo-local execution.
   - Keep `setup:vps`, `full-rebuild`, and `live:smoke` available for QA and operator diagnostics.

6. Tests:
   - `tests/vps-installer.test.ts` or a similar dedicated test file.
   - Existing setup/ops tests as needed.

7. Docs:
   - `docs/deployment/README.md`
   - `docs/deployment/vps.md`
   - `.env.example` only if new runtime variables are required.
   - Active brief reports and automation files.

## Risky Seam Inventory

- Host bootstrap seam: fresh VPS may lack Docker, Compose plugin, nginx, Certbot, git, curl, Node, or npm.
- Compose env seam: values from Compose `environment`, `env_file`, shell, and defaults can override each other.
- Setup path seam: host-generated setup JSON and container runtime setup JSON must be the same source of truth.
- Secret handling seam: raw Telegram/OpenAI values must be accepted for setup but not leaked.
- TLS seam: HTTPS requires DNS and port 80/443 reachability, which may be externally blocked.
- OpenClaw seam: default gateway discovery must remain fail-closed unless configure-later is explicit.
- Rerun seam: installer must not destroy existing setup or secrets on repeat execution.

## Edge-State Matrix

Handle:

- running from curl on a fresh Ubuntu VPS
- running from an already cloned repo
- Docker missing
- Docker already installed
- nginx missing
- nginx already installed
- existing managed nginx site
- existing conflicting nginx site
- DNS/TLS ready
- DNS/TLS not ready
- Telegram discovery empty then retry succeeds
- Telegram discovery empty then manual chat ID entry
- OpenClaw detected
- OpenClaw missing with install-or-onboard chosen
- OpenClaw missing with configure-later chosen
- OpenClaw missing in default detect-existing mode
- installer rerun after partial failure
- existing runtime env file with secrets

Fail closed when:

- unsupported OS
- prerequisite installation fails
- runtime env file cannot be created with mode `0600`
- setup JSON would contain raw secrets
- Compose services cannot become healthy
- nginx has a conflicting non-managed site for the requested domain
- Certbot fails for a reason that leaves HTTPS unconfigured; report this as external/deployment blocked without hiding it

## Required Tests

Add or update deterministic tests proving:

- `scripts/install-vps.sh` has valid bash syntax.
- dry-run mode prints the planned install/deploy steps without requiring root mutation.
- dry-run does not print raw secret values supplied through env.
- the installer defaults to `/opt/auto-forge-controller` and `/etc/auto-forge-controller/auto-forge.env`.
- the installer plans or invokes Docker official apt repo install steps only when Docker/Compose are missing.
- the installer plans or invokes nginx and Certbot steps only when selected.
- Compose config consumes the installer runtime env file and does not override install-time public URL, OpenClaw, Telegram, Codex, or setup path with stale hardcoded values.
- setup JSON remains references-only.
- runtime env file mode is `0600`.
- existing setup wizard tests still pass.

## Required Proof Commands

Run and report:

```bash
bash -n scripts/install-vps.sh
npm run test -- --run tests/vps-installer.test.ts tests/vps-setup-wizard.test.ts
npm run verify
npm run full-rebuild
```

Also run a dry-run proof command similar to:

```bash
AUTO_FORGE_INSTALL_DRY_RUN=1 \
AUTO_FORGE_PUBLIC_BASE_URL=https://forge.example.com \
TELEGRAM_BOT_TOKEN=redacted-test-telegram-token \
OPENAI_API_KEY=redacted-test-openai-key \
bash scripts/install-vps.sh --dry-run
```

The dry-run output must not contain the supplied raw token/key values.

If live credentials and DNS are available, run:

```bash
sudo bash scripts/install-vps.sh
npm run live:smoke
```

If live credentials, DNS, TLS, or OpenClaw are unavailable, stop as `BLOCKED_EXTERNAL` only after the deterministic installer, Compose, setup, and full-rebuild proof pass.

## Completion Report

Write a timestamped report under `reports/`, refresh `reports/LATEST.md`, refresh `reports/LATEST.json`, update `automation/state.json` and `automation/qa.json`, commit, push, and report:

- exact installer command supported
- exact deployment path automated
- how rerun/idempotency is handled
- how runtime env mode `0600` is guaranteed
- how Compose consumes installer runtime env/setup state
- how nginx/TLS is handled
- proof that raw secrets are not leaked
- files changed
- tests run
- implementation commit SHA
- stop report commit SHA
- push status

## QA Gate

QA cannot accept this revision until the normal fresh-VPS path is one guided installer command and no longer requires the operator to manually run chmod, Docker Compose, nginx install/config, Certbot, or smoke-test commands.

