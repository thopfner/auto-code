# Phase 1: Durable Store Health Proof

Gate: `QA_CHECKPOINT`  
Validation level: `SERVICE_RESTART`  
Initial authorization: authorized now

## Goal

Make deployed durable workflow state observable and falsifiable before publish retry depends on it.

## Enhanced Risky Seam Inventory

- Persistence truth: memory store versus Postgres store selection.
- Runtime config: API and worker must use the same `DATABASE_URL`.
- Restart durability: tasks and repo selections must survive API restart.
- Health semantics: checks must distinguish env presence from actual database connectivity/schema readiness.

## Edge-State Matrix

- `DATABASE_URL` missing in local tests: memory store remains valid.
- `DATABASE_URL` present and reachable: Postgres store selected; schema exists or is bootstrapped; health passes.
- `DATABASE_URL` present but unreachable: runtime should fail clearly or health should fail, not degrade silently as durable.
- old in-memory task lost before deploy: not recoverable; report as operator re-registration requirement.
- API restarted with Postgres: tasks and active repo selections remain visible.

## Owned Paths

- `apps/api/src/server.ts`
- `apps/worker/src/worker.ts`
- `packages/db/src/postgres-workflow-store.ts`
- `packages/core/src/workflow-store.ts` if interface changes are needed
- `packages/ops/src/health.ts`
- `apps/cli/src/index.ts` if health CLI output changes
- `tests/telegram-workflow-api.test.ts`
- `tests/ops.test.ts`
- `tests/e2e-hardening.test.ts` if restart proof fits existing e2e patterns
- `docker-compose.yml` only if runtime env wiring is incomplete
- this brief's `reports/**` and `automation/**`

## Required Implementation

- Add a store-mode/readiness surface that can report `memory` or `postgres`.
- Add a Postgres schema/readiness query that proves workflow tables are accessible.
- Ensure API startup selects Postgres when `DATABASE_URL` is set and fails clearly if store initialization cannot complete in runtime-required mode.
- Ensure worker health or startup can prove it sees the same `DATABASE_URL`; do not claim queue execution ownership yet.
- Add a restart-persistence test using the store abstraction. If a real Postgres test container is too heavy for unit tests, use a deterministic integration seam and require target Compose proof in the stop report.
- Keep `MemoryWorkflowStore` as default for injected unit tests without `DATABASE_URL`.

## Reuse Points

- `PostgresWorkflowStore.ensureSchema()`
- `collectHealth()`
- existing `/workflow/tasks`
- existing repo selection commands
- `docker-compose.yml` `DATABASE_URL`

## Do Not Change

- Do not implement worker queue consumption in this phase.
- Do not change product repo onboarding semantics.
- Do not alter Telegram secret handling.
- Do not create a second repo checkout.

## Required Proof

Run from source checkout:

```bash
npm run verify
```

For target validation after source push and pull:

```bash
cd /opt/auto-forge-controller
git rev-parse HEAD
npm install
docker compose up -d postgres api worker web
npm run ops:health
curl -s http://127.0.0.1:3000/workflow/tasks
docker compose restart api
curl -s http://127.0.0.1:3000/workflow/tasks
```

The stop report must state whether target proof was run. If target proof is blocked by environment, report `BLOCKED_EXTERNAL` with the exact missing condition.

## Allowed Runtime Commands

- `npm run verify`
- `npm run ops:health`
- `docker compose up -d postgres api worker web`
- `docker compose restart api`
- `docker compose logs --tail=100 api`
- `docker compose logs --tail=100 worker`
- `curl -s http://127.0.0.1:3000/workflow/tasks`

## Stop Gate

Stop for external QA after committing and pushing Phase 1. Do not start Phase 2 until QA clears this checkpoint.

