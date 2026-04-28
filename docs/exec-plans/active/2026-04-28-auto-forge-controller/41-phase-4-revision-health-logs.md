# Phase 4 Revision - Health And Log Discovery

Execution mode: `QA_CHECKPOINT`
Validation level: `FULL_REBUILD`

## Goal

Close the Phase 4 operations gaps without expanding into Phase 5. The current Docker, bootstrap, backup/restore, install docs, and recovery work should be preserved; this revision is limited to the missing service-health and service-log requirements.

## Source QA Findings

- `packages/ops/src/health.ts` defines `api` and `web` as possible health-check names, but `collectHealth()` never emits API or web checks. Phase 4 explicitly requires service health to expose web/API/worker/DB/OpenClaw/Codex status.
- `apps/cli/src/index.ts` only supports `logs --task <id>`, and `packages/ops/src/recovery.ts` only implements task log discovery. Phase 4 explicitly requires logs to be discoverable per task and service.

## Owned Files

- `packages/ops/src/health.ts`
- `packages/ops/src/recovery.ts` or a new small log-discovery module under `packages/ops/src/`
- `packages/ops/src/index.ts`
- `apps/cli/src/index.ts`
- `apps/api/src/server.ts` only if the API health response needs a small adapter change
- `tests/ops.test.ts`
- `docs/deployment/README.md`
- `docs/deployment/recovery.md`
- `docs/deployment/local.md` or `docs/deployment/vps.md` only if needed to document service logs
- active brief report and automation files

## Required Behavior

1. `npm run ops:health` must include health checks named at least:
   - `api`
   - `web`
   - `worker`
   - `database`
   - `openclaw`
   - `codex`
2. API and web checks may be `passed`, `degraded`, or `skipped` depending on configured endpoints, but they must be present and must explain what was checked or why it was skipped.
3. In Docker Compose smoke, the health model must be capable of proving API and web reachability when their service URLs are configured.
4. CLI log discovery must support both:
   - task logs, preserving `logs --task <task-id>`
   - service logs, for at least `api`, `worker`, `web`, and `postgres`
5. Service-log discovery may report structured commands/locations rather than reading Docker or systemd logs directly, but it must be actionable for the supported deployment paths:
   - Docker Compose: `docker compose logs <service>`
   - systemd: `journalctl -u auto-forge-api` and `journalctl -u auto-forge-worker`
   - local npm: `.auto-forge/logs/services/<service>/` when present, or a clear not-created status
6. Deployment docs must name how to inspect task logs and service logs.

## What Must Not Change

- Do not start Phase 5.
- Do not rewrite Docker Compose, backup/restore, bootstrap, or recovery flows unless required to wire health/log discovery.
- Do not add raw secret export to backups.
- Do not lower the production-grade acceptance bar.

## Required Tests

- Add unit coverage proving `collectHealth()` returns `api`, `web`, `worker`, `database`, `openclaw`, and `codex` check names.
- Add unit coverage proving service-log discovery returns actionable entries for Docker Compose and systemd service paths or commands.
- Keep existing ops, workflow, Codex runner, and artifact tests green.

## Required Runtime Evidence

Run and report:

```bash
npm run verify
npm run ops:health
npm run auto-forge -- logs --task phase-4-smoke
npm run auto-forge -- logs --service api
npm run auto-forge -- logs --service worker
docker compose build
AUTO_FORGE_API_PORT=<free-port> AUTO_FORGE_WEB_PORT=<free-port> docker compose up -d postgres api worker web
AUTO_FORGE_API_PORT=<same-free-port> AUTO_FORGE_WEB_PORT=<same-free-port> docker compose -f docker-compose.yml -f docker-compose.smoke.yml run --rm smoke
curl -fsS http://127.0.0.1:<api-port>/live
curl -fsS http://127.0.0.1:<web-port>/
docker compose down --remove-orphans
```

The Compose smoke health output must include API and web checks. Use alternate host ports when `3000` or `5173` are occupied.

## Stop Report Contract

Before stopping:

- identify the implementation commit SHA,
- write a timestamped Phase 4 revision report under `reports/`,
- refresh `reports/LATEST.md`,
- refresh `reports/LATEST.json`,
- refresh `automation/state.json`,
- refresh `automation/qa.json`,
- commit and push,
- report full 40-character implementation and stop-report SHAs.

## Gate

Stop for QA after this revision. Do not self-clear Phase 4.
