# Auto Forge Deployment

Auto Forge Controller supports two deployment paths:

- Local desktop: `scripts/bootstrap.sh`, then start API, worker, and web services with npm.
- VPS: clone the repo, run the same bootstrap, then either launch Docker Compose or install the systemd unit templates.

Both paths keep secrets out of Git. `.env` is local-only, backup bundles store secret references such as `env:OPENAI_API_KEY`, and raw Telegram/OpenClaw/Codex credentials must live in the operator shell, Docker secret manager, or `/etc/auto-forge-controller/auto-forge.env`.

## Required Commands

```bash
scripts/bootstrap.sh
npm run ops:health
npm run ops:backup -- --dry-run
npm run ops:restore -- --input backups/example.json --dry-run
npm run ops:install-check
```

## Service Ports

- API: `3000`
- Web onboarding UI: `5173`
- Postgres in Docker Compose: internal service `postgres:5432`

## Operational Files

- Setup record: `.auto-forge/setup.json`
- Worker heartbeat: `.auto-forge/worker-health.json`
- Task logs: `.auto-forge/logs/tasks/<task-id>/`
- Backups: `backups/auto-forge-backup-*.json`
- Active brief state: `docs/exec-plans/active/2026-04-28-auto-forge-controller/automation/`

## Health Model

`npm run ops:health` and `GET /health` report database config, onboarding setup, worker heartbeat, logs, Codex CLI availability, and OpenClaw reachability. OpenClaw is skipped by default to avoid failing offline installs; use `-- --live-external` or `/health?liveExternal=true` when credentials and network are ready.
