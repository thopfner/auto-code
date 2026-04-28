# Phase 4 QA Checkpoint

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-28T17:44:01Z`
Stop status: `QA_CHECKPOINT`

## Phase Addressed

- `40-phase-4-portability-ops.md` only

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`

## Implementation Summary

- Added Docker portability with `Dockerfile`, Docker Compose services for Postgres/API/worker/web, optional `.env` loading, alternate host-port support, healthchecks, and a Compose smoke service.
- Added systemd templates for API and worker service installs.
- Added `scripts/bootstrap.sh` for fresh-clone local/VPS bootstrap.
- Added an ops package for health checks, worker heartbeats, references-only backup/restore, install documentation dry runs, task log discovery, and recovery logging.
- Expanded the admin CLI with `health`, `backup`, `restore`, `recover`, `logs`, and `install-check` commands plus npm shortcuts.
- Extended API health with `/health` and `/live`, worker heartbeat publishing, and a live recovery endpoint to mark stuck tasks blocked or cancelled through controller state.
- Added deployment, local install, VPS install, and recovery runbooks under `docs/deployment/`.

## Files Changed

- `.dockerignore`
- `.env.example`
- `.gitignore`
- `Dockerfile`
- `README.md`
- `apps/api/src/server.ts`
- `apps/cli/src/index.ts`
- `apps/worker/src/worker.ts`
- `docker-compose.smoke.yml`
- `docker-compose.yml`
- `docs/deployment/README.md`
- `docs/deployment/local.md`
- `docs/deployment/recovery.md`
- `docs/deployment/vps.md`
- `package.json`
- `packages/adapters/src/setup-store.ts`
- `packages/ops/src/backup.ts`
- `packages/ops/src/health.ts`
- `packages/ops/src/index.ts`
- `packages/ops/src/install-check.ts`
- `packages/ops/src/paths.ts`
- `packages/ops/src/recovery.ts`
- `scripts/bootstrap.sh`
- `systemd/auto-forge-api.service`
- `systemd/auto-forge-worker.service`
- `tests/ops.test.ts`
- `tests/telegram-workflow-api.test.ts`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/automation/qa.json`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/automation/state.json`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/LATEST.json`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/LATEST.md`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/2026-04-28T17-44-01Z-phase-4-qa-checkpoint.md`

## Tests And Checks Run

```bash
npm run verify
npm run ops:health
npm run ops:backup -- --dry-run
npm run ops:backup -- --output /tmp/auto-forge-backup-XXXXXX.json
npm run ops:restore -- --input /tmp/auto-forge-backup-XXXXXX.json --dry-run
AUTO_FORGE_SETUP_PATH=/tmp/.../state/setup.json AUTO_FORGE_BACKUP_DIR=/tmp/.../backups npm run ops:backup -- --output /tmp/.../bundle.json
AUTO_FORGE_SETUP_PATH=/tmp/.../restored/setup.json npm run ops:restore -- --input /tmp/.../bundle.json --dry-run
npm run ops:recover -- --action list-stuck --dry-run
npm run ops:recover -- --action mark-blocked --task phase-4-smoke --dry-run
npm run auto-forge -- logs --task phase-4-smoke
rsync clean disposable path; npm ci; npm run ops:install-check
docker compose build
AUTO_FORGE_API_PORT=3300 AUTO_FORGE_WEB_PORT=5178 docker compose up -d postgres api worker web
AUTO_FORGE_API_PORT=3300 AUTO_FORGE_WEB_PORT=5178 docker compose -f docker-compose.yml -f docker-compose.smoke.yml run --rm smoke
curl -fsS http://127.0.0.1:3300/live
docker compose down --remove-orphans
```

Result: passed.

Verified checks:

- `npm run verify` passed ESLint, TypeScript, schema check, and Vitest: 12 files, 42 tests.
- CLI health passed with degraded-but-nonfatal local setup/database readiness and detected installed `codex-cli 0.125.0`.
- Backup dry run passed without writing secrets; disposable setup backup/restore dry run restored a references-only setup path.
- Install documentation dry run passed from a clean disposable copy after `npm ci`.
- Recovery CLI dry runs passed for stuck-list and mark-blocked actions; task log discovery returned an empty list for the dry-run task as expected.
- Docker Compose build passed for API, worker, and web images.
- Docker Compose smoke passed with Postgres/API/worker/web running on alternate host ports, API marked healthy, worker heartbeat fresh, and smoke `npm run ops:health` returning `ok: true`.
- API liveness smoke passed through `curl -fsS http://127.0.0.1:3300/live`.

## Commits

- Implementation commit SHA: `d6a0d8d2be699aa653a03e4ce3f2e416b5af53e7`
- Stop report commit SHA: `d6a0d8d2be699aa653a03e4ce3f2e416b5af53e7`

## Push Status

- Pending report metadata commit and push to `origin/main`.

## Blockers Or Residual Risks

- No Phase 5 work was started.
- Live OpenClaw and Telegram checks still require real credentials and are intentionally skipped unless `--live-external` or `/health?liveExternal=true` is used.
- Docker runtime currently uses TypeScript runtime entry points through `tsx`; a later production hardening pass may add compiled JS artifacts.
- Health reports Codex availability as degraded inside the Docker image because Codex CLI is not installed in the image yet; host CLI health detects `codex-cli 0.125.0`.
- Production DB persistence remains limited by the earlier in-memory workflow store; Phase 4 recovery exposes live API mutation and audit logging, but full durable task recovery depends on the production persistence work already listed as a broader known risk.

## Durable Memory Candidates

- Phase 4 added Docker Compose, systemd templates, one-command bootstrap, ops CLI, health checks, worker heartbeat, references-only backup/restore, recovery endpoint/logging, and deployment runbooks.
- Health checks distinguish hard failures from degraded install readiness so fresh clones can smoke offline while still surfacing missing setup, Codex, and OpenClaw readiness.
- Backup bundles use `auto-forge-backup-v1` with `references-only` secret policy and do not export raw Telegram/OpenClaw/Codex secrets.
