# Coding Agent Prompt

You are implementing one authorized window in the active repo.

Target:
- Repo: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Brief: `docs/exec-plans/active/2026-04-30-publish-retry-durable-workflow`
- Authorization: `10-phase-1-durable-store-health-proof.md` only

Read for context:
- Read mode: `FULL_REHYDRATE`
- Read these files, in order:
  - `AGENTS.md`
  - `docs/agent-memory/CURRENT_STATE.md`
  - `docs/agent-memory/ARCHITECTURE.md`
  - `docs/agent-memory/DECISIONS.md`
  - `docs/agent-memory/TESTING.md`
  - `docs/exec-plans/active/2026-04-30-publish-retry-durable-workflow/README.md`
  - `docs/exec-plans/active/2026-04-30-publish-retry-durable-workflow/01-brief-lineage-and-sources.md`
  - `docs/exec-plans/active/2026-04-30-publish-retry-durable-workflow/10-phase-1-durable-store-health-proof.md`
- Do not mention or invoke forge-bootstrap for this worker handoff.

Execute now:
- Implement only: Phase 1 durable store health proof.
- Goal: make deployed durable workflow state observable and falsifiable before publish retry depends on it.
- Owned paths: `apps/api/src/server.ts`, `apps/worker/src/worker.ts`, `packages/db/src/postgres-workflow-store.ts`, `packages/core/src/workflow-store.ts`, `packages/ops/src/health.ts`, `apps/cli/src/index.ts`, `tests/telegram-workflow-api.test.ts`, `tests/ops.test.ts`, `tests/e2e-hardening.test.ts`, `docker-compose.yml`, and this brief's `reports/**` plus `automation/**`.
- Reuse: `PostgresWorkflowStore.ensureSchema()`, `collectHealth()`, `/workflow/tasks`, repo selection commands, and existing Docker Compose `DATABASE_URL` wiring.
- Do not change: worker queue ownership, product repo onboarding semantics, Telegram secret handling, or repo topology.
- Later phases are context only until a new handoff authorizes them.

Quality bar:
- Satisfy the brief's Production-grade acceptance bar.
- Do not leave known cleanup, duplicated logic, brittle seams, TODO-driven behavior, untested behavior, or immediate refactor debt unless the brief explicitly authorizes it.

Validation:
- Validation level: `SERVICE_RESTART`
- Allowed runtime commands: `npm run verify`, `npm run ops:health`, `docker compose up -d postgres api worker web`, `docker compose restart api`, `docker compose logs --tail=100 api`, `docker compose logs --tail=100 worker`, `curl -s http://127.0.0.1:3000/workflow/tasks`.
- Required proof: `npm run verify`; target Compose restart persistence proof when target runtime access is available. If target proof cannot be run, stop with the exact blocker.
- If validation cannot be made truthful inside this level, stop and report the blocker.

Stop report:
- Write a timestamped report under the active brief's `reports/` folder.
- Refresh `reports/LATEST.md`.
- Refresh `reports/LATEST.json` only enough to keep it aligned with the newest stop report.
- Update `automation/state.json` only enough so it no longer claims stale `READY_FOR_IMPLEMENTATION`.
- Include a Durable memory candidates section with any facts that should be promoted to repo memory at final shipgate.
- Do not update durable repo memory at this intermediate checkpoint unless Phase 1 changes runtime-contract facts needed by later phases or fresh sessions.
- Commit and push at QA_CHECKPOINT or blocker stop unless the brief says otherwise.
- Report branch, files changed, tests run, implementation_commit_sha, stop_report_commit_sha, and push status.
