# Brief Lineage And Sources

## Lineage

- `2026-04-29-codex-runtime-deployment-hardening` established runtime hardening, GitHub onboarding, product repo selection, empty repo git-test, QA artifact contract, Postgres store baseline, and basic `/task retry`.
- Baseline source commit for this pack: `d34150d8dfb2f3b40eb5cdaaca515776530df775`.
- Latest live handoff reported target deployment was still behind at `35e82613c93b50205de5c73175081a664e05ea75`; target must pull `d34150d` before this pack is validated there.

## Repo Sources Checked

- `AGENTS.md`
- `docs/agent-memory/CURRENT_STATE.md`
- `docs/agent-memory/ARCHITECTURE.md`
- `docs/agent-memory/DECISIONS.md`
- `docs/agent-memory/TESTING.md`
- `docs/exec-plans/active/2026-04-29-codex-runtime-deployment-hardening/reports/LATEST.md`
- `apps/api/src/server.ts`
- `apps/worker/src/worker.ts`
- `packages/core/src/workflow-engine.ts`
- `packages/core/src/artifacts.ts`
- `packages/db/src/postgres-workflow-store.ts`
- `packages/ops/src/health.ts`
- `packages/ops/src/openclaw-setup.ts`
- `tests/vps-setup-wizard.test.ts`

## External Primary Sources

- node-postgres pooling docs: `https://node-postgres.com/features/pooling`
- node-postgres transaction docs: `https://node-postgres.com/features/transactions`
- PostgreSQL transaction tutorial: `https://www.postgresql.org/docs/15/tutorial-transactions.html`
- PostgreSQL `CREATE TABLE` reference: `https://www.postgresql.org/docs/current/sql-createtable.html`

Key source implications:

- Use `pool.query` for single statements where no transaction is needed.
- Use one checked-out client for transactional groups; do not spread a transaction across `pool.query`.
- Task/retry state plus events that must be atomic should be written together in a transaction.
- Schema changes should preserve explicit primary keys, foreign keys, and indexes for durable workflow records.

## Options Considered

### Option A: Keep Basic Retry And Ask Operators To Rerun Scope

Fit: smallest source change.  
Weakness: wastes Codex runs, risks changing already accepted code, and does not solve the product workflow.  
Verdict: rejected.

### Option B: Publish-Only Retry Driven By Canonical Artifacts

Fit: extends existing Forge artifact contract and `WorkflowStore` without a new queue subsystem.  
Strength: turns a common GitHub auth failure into an operational Telegram workflow.  
Risk: needs careful fail-closed repo state checks.  
Verdict: recommended.

### Option C: Full Queue Worker And Durable Retry Engine Now

Fit: long-term architecture direction.  
Strength: best eventual runtime model.  
Risk: too broad for the current checkpoint; mixes queue leases, worker ownership, publish retry, Telegram UX, and health in one risky phase.  
Verdict: defer after publish retry and durability proof are green.

## Recommended Approach

Implement Option B in checkpointed phases:

1. make the existing durable store runtime proof explicit
2. add publish-only retry with strict safety checks
3. expose usable Telegram/API task commands
4. validate on target deployment and repair stale test expectations

This best fits the repo now because `PostgresWorkflowStore`, canonical QA artifacts, repo registration, deploy-key commands, and basic `/task retry` already exist. The next level is classification and proof, not a new orchestration subsystem.

## What Would Justify A Different Choice Later

Move to Option C when the worker owns queue consumption, repo locks, retry leases, and recovery interaction. That should be a separate queue-runtime brief with transaction and concurrency design as the main subject.

