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

The Phase 4 brief requires: "Service health exposes web/API/worker/DB/OpenClaw/Codex status." `packages/ops/src/health.ts` defines `api` and `web` as possible health-check names, but `collectHealth()` never emits them. The CLI and Docker smoke health output currently includes only `database`, `setup`, `worker`, `logs`, `codex`, and `openclaw`.

Evidence:

```bash
npm run ops:health
```

Observed check names:

```text
database
setup
worker
logs
codex
openclaw
```

Docker Compose smoke has the same gap: API and web services can be up, and manual curls can pass, but the health model itself still does not expose API or web service status.

Required revision:

- Add API and web health checks to `collectHealth()`.
- Make them present in CLI health and API `/health` output.
- Allow configured URLs to prove reachability in Docker/local smoke, while returning a clear skipped/degraded status when a URL is not configured.
- Add tests proving health reports at least `api`, `web`, `worker`, `database`, `openclaw`, and `codex`.

Relevant files:

- `packages/ops/src/health.ts`
- `apps/api/src/server.ts` if needed
- `tests/ops.test.ts`
- `docker-compose.yml` / `docker-compose.smoke.yml` if needed for service URL env

### 2. Log discovery is task-only, not task and service

Type: `execution_miss`

The Phase 4 brief requires: "Logs are discoverable per task and service." The CLI currently supports only `logs --task <task-id>`, backed by `listTaskLogs()`. There is no `logs --service <service>` path, and the deployment docs only name `.auto-forge/logs/tasks/<task-id>/`.

Evidence:

```bash
rg -n "service log|journalctl|docker compose logs|logs" docs/deployment apps/cli/src/index.ts packages/ops/src
```

The only implemented CLI log path is task log discovery.

Required revision:

- Add service-log discovery for at least `api`, `worker`, `web`, and `postgres`.
- Preserve `logs --task <task-id>`.
- Make service-log output actionable for Docker Compose and systemd deployments. It can return commands/locations if direct log reads are deployment-specific.
- Update deployment docs with task and service log inspection instructions.
- Add tests for service-log discovery.

Relevant files:

- `apps/cli/src/index.ts`
- `packages/ops/src/recovery.ts` or a new `packages/ops/src/logs.ts`
- `packages/ops/src/index.ts`
- `tests/ops.test.ts`
- `docs/deployment/README.md`
- `docs/deployment/recovery.md`
- `docs/deployment/local.md` or `docs/deployment/vps.md`

## Verification Run By QA

```bash
npm run verify
```

Result: passed. ESLint, TypeScript, schema check, and Vitest passed: 12 files, 42 tests.

```bash
npm run ops:health
npm run ops:backup -- --dry-run
npm run ops:recover -- --action list-stuck --dry-run
npm run auto-forge -- logs --task phase-4-smoke
npm run ops:install-check
```

Result: commands ran, but health and log outputs confirmed the gaps above.

```bash
docker compose build
AUTO_FORGE_API_PORT=3301 AUTO_FORGE_WEB_PORT=5179 docker compose up -d postgres api worker web
AUTO_FORGE_API_PORT=3301 AUTO_FORGE_WEB_PORT=5179 docker compose -f docker-compose.yml -f docker-compose.smoke.yml run --rm smoke
curl -fsS http://127.0.0.1:3301/live
curl -fsS http://127.0.0.1:5179/
docker compose down --remove-orphans
```

Result: Docker build and runtime smoke passed; the smoke health output still lacked API and web checks.

## Delivered Revision Pack

- `41-phase-4-revision-health-logs.md`

## Required Next Stop

Return to QA after:

- health reports API and web status,
- service logs are discoverable through the CLI and docs,
- tests cover both requirements,
- FULL_REBUILD evidence is repeated,
- report and automation artifacts are refreshed and pushed.

## QA Status

`REVISION_PACK_REQUIRED`
