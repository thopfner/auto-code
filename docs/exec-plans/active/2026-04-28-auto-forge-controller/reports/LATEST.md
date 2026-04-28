# Phase 4 QA Review - Revision Required

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-28T17:51:49Z`
Stop status: `REVISION_PACK_REQUIRED`

## Phase Reviewed

- `40-phase-4-portability-ops.md`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Reviewed implementation commit SHA: `d6a0d8d2be699aa653a03e4ce3f2e416b5af53e7`
- Worker stop report commit SHA: `b78d6bfca718ad90647b681f3a28640907579ab9`
- Current pushed HEAD during QA: `005286bc3195c18a96e24b80396e240ba32cd8e1`

## Findings

### 1. Service health does not expose API or web status

Type: `execution_miss`

The Phase 4 brief requires service health to expose web/API/worker/DB/OpenClaw/Codex status. `collectHealth()` never emits API or web checks, and the CLI/Docker smoke health output lacks those service statuses.

Required revision:

- Add API and web health checks to `collectHealth()`.
- Make them present in CLI health and API `/health` output.
- Add tests proving health reports at least `api`, `web`, `worker`, `database`, `openclaw`, and `codex`.

### 2. Log discovery is task-only, not task and service

Type: `execution_miss`

The Phase 4 brief requires logs to be discoverable per task and service. The CLI currently supports only `logs --task <task-id>`, and the deployment docs only name task log paths.

Required revision:

- Add service-log discovery for at least `api`, `worker`, `web`, and `postgres`.
- Preserve `logs --task <task-id>`.
- Update deployment docs with task and service log inspection instructions.
- Add tests for service-log discovery.

## Verification Run By QA

```bash
npm run verify
npm run ops:health
npm run ops:backup -- --dry-run
npm run ops:recover -- --action list-stuck --dry-run
npm run auto-forge -- logs --task phase-4-smoke
npm run ops:install-check
docker compose build
AUTO_FORGE_API_PORT=3301 AUTO_FORGE_WEB_PORT=5179 docker compose up -d postgres api worker web
AUTO_FORGE_API_PORT=3301 AUTO_FORGE_WEB_PORT=5179 docker compose -f docker-compose.yml -f docker-compose.smoke.yml run --rm smoke
curl -fsS http://127.0.0.1:3301/live
curl -fsS http://127.0.0.1:5179/
docker compose down --remove-orphans
```

Result: commands ran. `npm run verify`, Docker build, Compose runtime, API liveness, and web serving passed. The health and logs outputs confirmed the blocking gaps above.

## Delivered Revision Pack

- `41-phase-4-revision-health-logs.md`

## QA Status

`REVISION_PACK_REQUIRED`
