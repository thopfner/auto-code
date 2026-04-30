# Phase 1 Durable Store Health Proof

- updated_at: `2026-04-30T10:40:58Z`
- stop_status: `QA_CHECKPOINT`
- implementation_commit_sha: `PENDING_COMMIT`
- stop_report_commit_sha: `PENDING_COMMIT`
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
npm run test -- tests/ops.test.ts tests/telegram-workflow-api.test.ts
npm run verify
```

Results:

- `npm run typecheck`: passed.
- Targeted tests: 29 tests passed.
- `npm run verify`: lint, typecheck, schema check, and 134 tests passed.

Target Compose/restart proof was not run from this checkout because `/opt/auto-forge-controller` is not present in this environment. Run the target validation sequence after pulling this commit on the VPS.

## Residual Risk

- This phase proves durable-store readiness and API restart visibility through the store abstraction. It does not implement worker queue ownership, which remains out of scope for Phase 1.
- Target validation still needs to prove API and worker containers see the same `DATABASE_URL` and that `/workflow/tasks` survives an API container restart on the deployed VPS.

## Durable Memory Candidates

- Runtime health must report the active workflow store mode (`memory` or `postgres`) and fail clearly when Postgres is configured but unreachable or missing schema tables.
- Worker heartbeat files should include sanitized workflow-store mode metadata so host health can confirm API and worker topology without exposing secrets.
