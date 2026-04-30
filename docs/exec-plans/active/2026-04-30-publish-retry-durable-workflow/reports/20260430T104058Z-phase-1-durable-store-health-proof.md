# Phase 1 Durable Store Health Proof

- updated_at: `2026-04-30T10:40:58Z`
- stop_status: `QA_CHECKPOINT`
- implementation_commit_sha: `a58e6321dd1ac1d789ebe285ce7baf0ec554a0ce`
- stop_report_commit_sha: `a58e6321dd1ac1d789ebe285ce7baf0ec554a0ce`
- next_authorized_phase: `10-phase-1-durable-store-health-proof.md`

## Summary

Phase 1 added an explicit workflow-store readiness contract and made health checks prove the actual store mode instead of only checking environment shape.

The API now selects `PostgresWorkflowStore` when `DATABASE_URL` is present, checks store readiness during Fastify startup, exposes `GET /workflow/store`, and passes the live store into `/health`. The Postgres store can bootstrap/check the workflow schema and report a sanitized connection fingerprint. Worker heartbeats now include workflow-store mode metadata without exposing `DATABASE_URL`.

## Files Changed

- `apps/api/src/server.ts`
- `packages/core/src/workflow-store.ts`
- `packages/db/src/postgres-workflow-store.ts`
- `packages/ops/src/health.ts`
- `tests/ops.test.ts`
- `tests/telegram-workflow-api.test.ts`

## Verification

```bash
npm run typecheck
npx vitest run --config vitest.config.ts tests/ops.test.ts tests/telegram-workflow-api.test.ts
npm run verify
npm run ops:health
AUTO_FORGE_API_PORT=3110 AUTO_FORGE_WEB_PORT=5180 docker compose up -d postgres api worker web
curl -s http://127.0.0.1:3110/workflow/tasks
docker compose restart api
curl -s http://127.0.0.1:3110/workflow/tasks
docker compose logs --tail=100 api
docker compose logs --tail=100 worker
docker compose down --remove-orphans
```

Results:

- `npm run typecheck`: passed.
- Targeted tests: 30 tests passed.
- `npm run verify`: lint, typecheck, schema check, and 134 tests passed.
- `npm run ops:health`: passed; source checkout reported `database` mode `memory` because no host `DATABASE_URL` was configured.
- Source Compose proof: initial attempt on host port `3101` was blocked by an existing listener; retry on `3110`/`5180` passed. API, worker, web, and Postgres came up; `/workflow/tasks` returned `{"tasks":[]}` before and after `docker compose restart api`; API and worker logs showed startup and the expected restart SIGTERM only; the stack was cleaned down with `docker compose down --remove-orphans`.

Target Compose/restart proof was blocked because `/opt/auto-forge-controller` is not present in this environment. BLOCKED_EXTERNAL: target deployed checkout is unavailable here, so the target must pull the pushed commit and run the phase validation sequence there.

## Residual Risk

- This phase proves durable-store readiness and source Compose API restart visibility through the store abstraction. It does not implement worker queue ownership, which remains out of scope for Phase 1.
- Target validation still needs to prove API and worker containers see the same `DATABASE_URL` and that `/workflow/tasks` survives an API container restart on the deployed VPS after the pushed commit is pulled there.

## Durable Memory Candidates

- Runtime health must report the active workflow store mode (`memory` or `postgres`) and fail clearly when Postgres is configured but unreachable or missing schema tables.
- Worker heartbeat files should include sanitized workflow-store mode metadata so host health can confirm API and worker topology without exposing secrets.
