# Auto Forge Deployment

Auto Forge Controller supports two deployment paths:

- Local desktop: `scripts/bootstrap.sh`, then start API, worker, and web services with npm.
- VPS: run the one-command installer, which installs prerequisites, writes runtime setup, starts Docker Compose, configures nginx/TLS when selected, and runs health/smoke gates.

Both paths keep secrets out of Git. `.env` is local-only, backup bundles store secret references such as `env:OPENAI_API_KEY`, and raw Telegram/Codex credentials must live in the operator shell, Docker secret manager, or `/etc/auto-forge-controller/auto-forge.env`. OpenClaw gateway auth is normally discovered or managed by OpenClaw; explicit webhook auth references are only for advanced installs. Codex CLI is a repo-managed dependency installed by `npm ci` at `node_modules/.bin/codex`; use `CODEX_CLI_COMMAND` only when intentionally overriding that managed binary.

## Required Commands

```bash
curl -fsSL https://raw.githubusercontent.com/thopfner/auto-code/main/scripts/install-vps.sh | sudo bash
npm run install:vps
scripts/bootstrap.sh
npm run setup:vps
npm run ops:health
npm run ops:backup -- --dry-run
npm run ops:restore -- --input backups/example.json --dry-run
npm run ops:install-check
npm run full-rebuild
npm run live:smoke
```

`scripts/install-vps.sh` is the primary fresh-VPS path. It supports curl-pipe and repo-local execution, verifies Ubuntu, installs missing git/curl/Node/Docker prerequisites, runs bootstrap in installer-aware mode, creates `/etc/auto-forge-controller/auto-forge.env` with mode `0600`, writes references-only setup JSON into the Compose-mounted data directory, builds and starts Postgres/API/worker/web, installs nginx when selected, optionally runs Certbot, then runs Compose health/smoke and `npm run live:smoke`. The installer supports Codex ChatGPT OAuth through device auth or API-key auth through `OPENAI_API_KEY`; OAuth stores `CODEX_AUTH_REF=secret:codex-oauth-local-cache` and mounts the host Codex auth cache into the worker container.

`npm run setup:vps` remains the guided setup artifact command used internally by the installer and for diagnostics after clone/bootstrap. It asks for the controller public URL, Nginx preference, API/web upstream ports, OpenClaw setup mode, Telegram bot token reference or value, Telegram chat ID, and Codex auth mode. The default OpenClaw mode is `detect-existing`, which runs `openclaw gateway status --json --require-rpc` and stores gateway details as references. In the one-command installer, `install-or-onboard` installs OpenClaw, initializes `gateway.mode=local` non-interactively, and starts the gateway; if OpenClaw's own service install/start does not produce a healthy gateway, the installer adds a system-level `/etc/systemd/system/openclaw-gateway.service` fallback before marking OpenClaw `configure-later`. Use `advanced-webhook` only when you intentionally manage a webhook auth reference. Raw values are written only to an ignored env file such as `.env` or `/etc/auto-forge-controller/auto-forge.env`; setup JSON stores references only. OAuth device auth is supported by both the guided setup command and the one-command VPS installer.

`npm run live:smoke` requires staged or live `OPENCLAW_BASE_URL`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_TEST_CHAT_ID`. It also requires either `OPENAI_API_KEY` when `CODEX_AUTH_REF=env:OPENAI_API_KEY`, or a completed Codex OAuth device-auth cache when `CODEX_AUTH_REF=secret:codex-oauth-local-cache`. Default gateway mode does not require `OPENCLAW_TOKEN`; advanced webhook mode requires `OPENCLAW_AUTH_REF`. Without required values it exits with `BLOCKED_EXTERNAL` and lists the missing requirements. The setup wizard can run the same live smoke path after it writes the env file and setup record.

## Service Ports

- API: `3000`
- Web onboarding UI: `5173`
- Postgres in Docker Compose: internal service `postgres:5432`

## Operational Files

- Setup record: `.auto-forge/setup.json`
- Installer runtime env: `/etc/auto-forge-controller/auto-forge.env`
- Installer Compose data directory: `/opt/auto-forge-controller/.auto-forge/compose-data/`
- Setup wizard Nginx preview: `.auto-forge/nginx/<domain>.conf`
- Worker heartbeat: `.auto-forge/worker-health.json`
- Task logs: `.auto-forge/logs/tasks/<task-id>/`
- Local npm service logs, when a service creates them: `.auto-forge/logs/services/<service>/`
- Backups: `backups/auto-forge-backup-*.json`
- Active brief state: `docs/exec-plans/active/2026-04-28-auto-forge-controller/automation/`

## Health Model

`npm run ops:health` and `GET /health` report API reachability, web reachability, database config, onboarding setup, worker heartbeat, logs, repo-managed Codex CLI availability, and OpenClaw reachability. API reachability uses `AUTO_FORGE_API_HEALTH_URL` when set, otherwise `/live` under `AUTO_FORGE_PUBLIC_BASE_URL`. Web reachability uses `AUTO_FORGE_WEB_HEALTH_URL` or `AUTO_FORGE_WEB_BASE_URL` when set. The Codex check fails if an explicit `CODEX_CLI_COMMAND` override is not executable, or if the managed binary is missing after bootstrap/build. OpenClaw is skipped by default to avoid failing offline installs; use `-- --live-external` or `/health?liveExternal=true` when credentials and network are ready.

## Log Discovery

Task logs remain discoverable with:

```bash
npm run auto-forge -- logs --task <task-id>
```

Service logs are discoverable with:

```bash
npm run auto-forge -- logs --service api
npm run auto-forge -- logs --service worker
npm run auto-forge -- logs --service web
npm run auto-forge -- logs --service postgres
```

The service-log output reports the local npm log directory status, the matching Docker Compose command such as `docker compose logs api`, and systemd journal commands for the bundled API and worker units.
