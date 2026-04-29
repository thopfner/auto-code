# VPS Install

## One-Command Install

Run this on a fresh Ubuntu VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/thopfner/auto-code/main/scripts/install-vps.sh | sudo bash
```

From an already cloned checkout, run:

```bash
sudo bash scripts/install-vps.sh
```

The installer is the normal VPS deployment path. It installs or verifies git, curl, Node.js 24, npm 11, Docker Engine, and the Docker Compose plugin; clones or updates `/opt/auto-forge-controller`; runs bootstrap with installer-specific output; writes `/etc/auto-forge-controller/auto-forge.env` with mode `0600`; writes references-only setup JSON into the Compose-mounted data directory; builds and starts Postgres, API, worker, and web; installs/reloads nginx when selected; optionally runs Certbot; runs Compose health/smoke checks; and then runs the live external smoke gate.

Dry-run proof is available without mutating the host:

```bash
AUTO_FORGE_INSTALL_DRY_RUN=1 \
AUTO_FORGE_PUBLIC_BASE_URL=https://forge.example.com \
TELEGRAM_BOT_TOKEN=<token> \
OPENAI_API_KEY=<key> \
bash scripts/install-vps.sh --dry-run
```

Dry-run output redacts raw secret values and prints only planned infrastructure actions.

## Guided Inputs

The installer asks only for product-level values:

- install directory, default `/opt/auto-forge-controller`
- runtime env file, default `/etc/auto-forge-controller/auto-forge.env`
- public domain or base URL
- whether to configure nginx
- whether to enable HTTPS through Certbot
- OpenClaw setup mode and gateway URL when needed
- Telegram bot token
- Telegram chat ID, with `getUpdates` discovery and manual fallback
- Codex auth mode, either ChatGPT OAuth device auth or OpenAI API key

`OPENCLAW_SETUP_MODE=detect-existing` is the default and remains fail-closed if the OpenClaw gateway cannot be discovered. Use `install-or-onboard` when the VPS should install OpenClaw and start the gateway daemon non-interactively. The installer does not launch OpenClaw's own interactive onboarding wizard; if OpenClaw's own service install/start does not produce a healthy gateway, the installer adds a system-level `/etc/systemd/system/openclaw-gateway.service` fallback before marking OpenClaw `configure-later`. Use `configure-later` to save an explicitly incomplete setup that health/live smoke will report as externally blocked. Use `advanced-webhook` only when you intentionally provide an `env:` or `secret:` auth reference for an existing webhook integration.

The one-command installer supports Codex ChatGPT OAuth and API-key auth. OAuth runs the repo-managed `codex login --device-auth` flow, writes `CODEX_AUTH_REF=secret:codex-oauth-local-cache`, and mounts the selected host Codex auth cache into the worker container. API-key auth writes `CODEX_AUTH_REF=env:OPENAI_API_KEY`.

## Runtime Files

- Runtime env: `/etc/auto-forge-controller/auto-forge.env`, mode `0600`
- Compose project env pointers: `/opt/auto-forge-controller/.env`
- Codex OAuth cache: `/root/.codex` by default, mounted read-only into the worker container when OAuth is selected
- Host setup JSON: `/opt/auto-forge-controller/.auto-forge/compose-data/setup.json`
- Container setup JSON path: `/data/setup.json`
- Logs/backups/worker heartbeat in the same Compose data directory under `/data`

The setup JSON stores references such as `env:TELEGRAM_BOT_TOKEN`, `env:OPENAI_API_KEY`, or `secret:codex-oauth-local-cache`; it must not contain raw Telegram/OpenAI/OpenClaw secret values. The runtime env file is the only installer-managed place for raw API-key secret values.

## Reruns And Recovery

The installer is safe to rerun. It updates an existing Git checkout with `git pull --ff-only`, rewrites only the managed setup block in the runtime env file, preserves the Compose data directory, and reuses existing Docker/nginx/Certbot installs. If nginx already has a non-Auto-Forge site at the managed site name, `scripts/configure-nginx.sh` fails closed so the operator can inspect the conflict.

If Certbot, DNS, Telegram, OpenClaw, or OpenAI validation is not ready, deterministic Compose deployment can still complete and the final live gate reports `BLOCKED_EXTERNAL`. Resolve the external dependency and rerun the installer.

## Diagnostic Commands

These commands remain available for QA and operator diagnostics:

```bash
npm run setup:vps
npm run ops:health
npm run ops:backup -- --dry-run
npm run ops:restore -- --input backups/example.json --dry-run
npm run full-rebuild
npm run live:smoke
npm run auto-forge -- logs --service api
npm run auto-forge -- logs --service worker
npm run auto-forge -- logs --service web
npm run auto-forge -- logs --service postgres
```

Manual Docker Compose diagnostics should load the project `.env` that the installer writes:

```bash
cd /opt/auto-forge-controller
docker compose ps
docker compose logs api
docker compose logs worker
docker compose logs web
docker compose logs postgres
```
