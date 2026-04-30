# Problem Framing

## Objective

Make blocked-but-locally-clear tasks operationally recoverable and prove the controller's workflow state is durable across deployed service restarts.

## Desired Outcome

When local QA passes but GitHub push fails, Telegram reports a retryable publishing blocker. After credentials or deploy keys are fixed, `/task retry <task-id>` retries only the push and completes the existing task when the push succeeds.

Repo registrations, active repo selections, task state, events, approvals, artifacts, and retry attempts remain visible after API/container restart.

## In Scope

- durable store health and startup proof
- Postgres workflow store hardening where current code is too optimistic
- publish-failure classification from canonical Forge QA artifacts
- publish-only retry safety checks
- `/task retry`, `/task status`, `/task logs`
- `/workflow/tasks/:taskId/recover` retry actions
- exact Telegram wording for publish blockers and retry outcomes
- OpenClaw setup wizard test expectation repair when it reflects current intended behavior

## Out Of Scope

- replacing deploy keys with a GitHub App
- implementing the worker as the full durable queue consumer
- multi-tenant RBAC
- building the frontend dashboard for task retry
- migrating historical in-memory state that was already lost before Postgres persistence landed

## Constraints And Invariants

- The source checkout is `/var/www/html/auto.thapi.cc`; deployed proof runs in `/opt/auto-forge-controller` after pulling the accepted commit.
- Secrets must stay server-side. Telegram can show public keys, fingerprints, task IDs, and remediation steps only.
- Publish retry must fail closed when repo HEAD, branch, working tree, or canonical artifact state is not safe.
- A pure publish retry must not rerun Codex agents unless safety checks prove the accepted QA state is stale.
- Postgres runtime proof must distinguish "env configured" from "store connected and used."

## Relevant Code Surfaces

- `apps/api/src/server.ts`
- `apps/worker/src/worker.ts`
- `packages/core/src/workflow-engine.ts`
- `packages/core/src/artifacts.ts`
- `packages/core/src/workflow-store.ts`
- `packages/core/src/types.ts`
- `packages/db/src/postgres-workflow-store.ts`
- `packages/ops/src/health.ts`
- `packages/ops/src/openclaw-setup.ts`
- `packages/ops/src/recovery.ts`
- `tests/workflow-engine.test.ts`
- `tests/telegram-workflow-api.test.ts`
- `tests/artifact-validation.test.ts`
- `tests/vps-setup-wizard.test.ts`
- `docker-compose.yml`

## Unknowns And Risks

- Whether the target VPS has already restarted after pulling `d34150d`; any state created under the old memory store is not recoverable unless still in the running process.
- Whether product repos use HTTPS or SSH remotes at retry time. The retry path must report this clearly rather than mutating remotes unexpectedly.
- Worker currently writes heartbeat only. The brief can prove shared durable store configuration now, but true worker-owned queue execution remains a later subsystem.
- Git push is external and can fail for auth, remote rejection, branch protection, diverged remote, host-key, or network reasons. The retry classifier must preserve exact failure detail.

