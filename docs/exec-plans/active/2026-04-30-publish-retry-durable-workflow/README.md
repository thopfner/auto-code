# Publish Retry And Durable Workflow Hardening

Brief ID: `2026-04-30-publish-retry-durable-workflow`  
Pack type: `brief-full`  
Created: `2026-04-30T10:31:38Z`  
Branch: `main`  
Source baseline: `d34150d8dfb2f3b40eb5cdaaca515776530df775`

## Objective

Bring the deployed Auto Forge Controller from truthful blocked reporting to operational Telegram-managed product development by making durability and task retry production-grade.

## Current Reality

The source repo already contains the first durable workflow store and basic `/task retry` repair at `d34150d8dfb2f3b40eb5cdaaca515776530df775`.

Remaining work:

- prove runtime durability on the deployed target when `DATABASE_URL` is configured
- make health and installer checks report durable store truth, not just env presence
- classify `qa_status: CLEAR_CURRENT_PHASE` plus failed `push_status` as a retryable publishing blocker
- make `/task retry <task-id>` retry only the publish step when local QA already passed and repo state is unchanged
- add `/task status <task-id>` and `/task logs <task-id>`
- extend recovery API with explicit retry modes
- fix or intentionally update the OpenClaw setup wizard test expectation

## Production-Grade Acceptance Bar

Source of truth: repo conventions plus official primary-source docs for PostgreSQL and node-postgres.

Ship-ready means:

- deployed API state survives API/container restart when `DATABASE_URL` is set
- runtime health proves the API can connect to the durable store and can report whether memory or Postgres is active
- retry behavior is classified and idempotent; ambiguous blockers are refused rather than rerun blindly
- publish-only retry does not rerun scope, planner, worker, or QA when canonical artifacts prove local QA already passed and repo state is still clean
- GitHub push failures remain actionable in Telegram with exact remediation
- task/retry events are audit-visible and durable
- `npm run verify` passes before any checkpoint stop
- target validation runs from `/opt/auto-forge-controller` after the accepted source commit is pulled

Forbidden shortcuts:

- do not treat `DATABASE_URL` presence as proof that durable state is being used
- do not use generic "QA blocked" language for publish-only failures
- do not rerun full task phases for a pure publish retry unless artifact or repo state safety checks fail
- do not send secrets, private keys, tokens, or auth caches through Telegram
- do not hide push/auth failures behind generic Codex or runner errors

## Initial Authorized Window

Only `10-phase-1-durable-store-health-proof.md` is authorized now.

Later phases are context only until Phase 1 clears external QA.

## Phase Map

1. `10-phase-1-durable-store-health-proof.md` - durable store startup, health, and restart proof.
2. `20-phase-2-publish-aware-retry.md` - classify and execute push-only retry.
3. `30-phase-3-task-command-ux-and-recovery.md` - Telegram/API task status, logs, and recovery retry modes.
4. `40-phase-4-target-validation-and-test-repair.md` - OpenClaw test repair and target deployment smoke.
5. `90-final-qa-and-merge-gate.md` - final independent QA.
6. `99-memory-pack-update.md` - final memory and archive closeout.

## Invariants

- `/var/www/html/auto.thapi.cc` is the source/dev checkout.
- Deployment proof must pull the accepted source commit into the target install, commonly `/opt/auto-forge-controller`.
- The deployed controller is the harness. It must not become the implicit product repo.
- Product repos are registered aliases under allowed roots such as `/data/repos/<alias>`.
- No `git worktree`, sibling clone, or duplicate checkout is authorized by this brief.
- `QA_CHECKPOINT` and `FINAL_SHIPGATE` are external review gates and may not be self-cleared.

