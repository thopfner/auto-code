# Auto Forge Deployment

Auto Forge Controller supports two deployment paths:

- Local desktop: `scripts/bootstrap.sh`, then start API, worker, and web services with npm.
- VPS: clone the repo, run the same bootstrap, then either launch Docker Compose or install the systemd unit templates.

Both paths keep secrets out of Git. `.env` is local-only, backup bundles store secret references such as `env:OPENAI_API_KEY`, and raw Telegram/OpenClaw/Codex credentials must live in the operator shell, Docker secret manager, or `/etc/auto-forge-controller/auto-forge.env`.

## Required Commands

```bash
scripts/bootstrap.sh
npm run setup:vps
npm run ops:health
npm run ops:backup -- --dry-run
npm run ops:restore -- --input backups/example.json --dry-run
npm run ops:install-check
npm run full-rebuild
npm run live:smoke
```

`npm run setup:vps` is the guided fresh-VPS path after clone/bootstrap. It asks for the controller public URL, Nginx preference, API/web upstream ports, OpenClaw gateway URL, OpenClaw token reference or value, Telegram bot token reference or value, Telegram chat ID, and Codex auth mode. Raw values are written only to an ignored env file such as `.env` or `/etc/auto-forge-controller/auto-forge.env`; `.auto-forge/setup.json` stores references such as `env:OPENCLAW_TOKEN`.

`npm run live:smoke` requires staged or live `OPENCLAW_BASE_URL`, `OPENCLAW_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_TEST_CHAT_ID`, and `OPENAI_API_KEY`. Without those values it exits with `BLOCKED_EXTERNAL` and lists the missing requirements. The setup wizard can run the same live smoke path after it writes the env file and setup record.

## Service Ports

- API: `3000`
- Web onboarding UI: `5173`
- Postgres in Docker Compose: internal service `postgres:5432`

## Operational Files

- Setup record: `.auto-forge/setup.json`
- Setup wizard Nginx preview: `.auto-forge/nginx/<domain>.conf`
- Worker heartbeat: `.auto-forge/worker-health.json`
- Task logs: `.auto-forge/logs/tasks/<task-id>/`
- Local npm service logs, when a service creates them: `.auto-forge/logs/services/<service>/`
- Backups: `backups/auto-forge-backup-*.json`
- Active brief state: `docs/exec-plans/active/2026-04-28-auto-forge-controller/automation/`

## Health Model

`npm run ops:health` and `GET /health` report API reachability, web reachability, database config, onboarding setup, worker heartbeat, logs, Codex CLI availability, and OpenClaw reachability. API reachability uses `AUTO_FORGE_API_HEALTH_URL` when set, otherwise `/live` under `AUTO_FORGE_PUBLIC_BASE_URL`. Web reachability uses `AUTO_FORGE_WEB_HEALTH_URL` or `AUTO_FORGE_WEB_BASE_URL` when set. OpenClaw is skipped by default to avoid failing offline installs; use `-- --live-external` or `/health?liveExternal=true` when credentials and network are ready.

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
