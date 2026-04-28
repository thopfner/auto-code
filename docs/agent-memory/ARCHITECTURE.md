# Auto Forge Controller Architecture Memory

Last refreshed: 2026-04-28

## Target System Map

- Web app and onboarding UI: guides installation, validates OpenClaw, Telegram, Codex, repo access, users, and runner profiles.
- Controller API: receives OpenClaw webhooks or gateway events, exposes admin/status endpoints, and owns task transitions.
- Queue and scheduler: serializes repo work, dispatches Codex runs, and resumes waiting tasks after approvals.
- Runner layer: launches role-specific Codex sessions for scope, plan/QA, and worker execution.
- Artifact watcher: reads Forge reports, automation JSON, git branch, commit SHAs, push status, and brief archive state.
- Notification layer: sends Telegram status, questions, approvals, blockers, and closeout summaries through OpenClaw.
- Operations layer: health checks, logs, backups, recovery commands, and systemd/Docker Compose deployment.

## Planned Entry Points

- `web` service: browser onboarding and operator dashboard.
- `api` service: controller HTTP API and OpenClaw webhook endpoint.
- `worker` service: queue consumer and Codex runner supervisor.
- `watcher` service or worker role: artifact and git-state reconciliation.
- `cli` command: local admin, bootstrap, backup, restore, health, and repair workflows.

## Data Flow

```text
Telegram /scope
  -> OpenClaw Telegram session
  -> OpenClaw webhook or controller tool call
  -> controller task created
  -> scope runner
  -> optional Telegram clarification
  -> planner runner
  -> optional Telegram approval
  -> worker runner
  -> artifact watcher detects QA stop
  -> QA runner
  -> revision/replan/next worker or final closeout
  -> Telegram summary and completed task
```

## Storage And State

- Production state should use Postgres.
- Local/dev mode may use SQLite WAL if the implementation keeps the same repository and migration contract.
- Persistent state must include users, repos, OpenClaw connection, Telegram connection metadata, tasks, task events, runner profiles, run attempts, approvals, artifacts, and locks.
- Logs must be stored per task and per run, with JSONL output retained for Codex executions.

## External Integrations

- OpenClaw gateway: Telegram ingress, outbound messaging, optional webhooks and TaskFlow integration.
- Telegram Bot API: slash command menu, message delivery, callback buttons, and webhook constraints.
- Codex CLI: current Phase 3 runner adapter uses `codex exec --json --config approval_policy="..." --output-last-message ...` and supports read-only runner smoke with installed `codex-cli 0.125.0`.
- Git/SSH: repo state, commits, pushes, and artifact verification.

## Phase 3 Runtime Contracts

- The workflow engine owns scope, planner, worker, QA, revision, replan, blocked, cancellation, and completion routing.
- Human clarification and planning approval pause through the operator gateway and resume through approval responses.
- Artifact-derived QA routing must validate `reports/LATEST.md`, `reports/LATEST.json`, `automation/state.json`, `automation/qa.json`, branch, full 40-character commit SHAs, and remote push containment before routing outcomes.
- `REVISION_PACK_REQUIRED` maps to a worker revision loop; `REPLAN_REQUIRED` maps to planner; `BLOCKED_EXTERNAL` maps to blocked.

## Phase 4 Operations Contracts

- Docker Compose defines Postgres, API, worker, web, and smoke services.
- API and worker have bundled systemd unit templates.
- `scripts/bootstrap.sh` is the fresh-clone bootstrap entry point.
- Health reports API, web, worker, database, setup, logs, Codex, and OpenClaw readiness. OpenClaw live checks are opt-in.
- Backup bundles use `auto-forge-backup-v1` with `references-only` secret policy and do not export raw Telegram/OpenClaw/Codex secrets.
- Recovery commands record operator intent and expose API mutation for the running in-memory workflow store.
- Task logs are under `.auto-forge/logs/tasks/<task-id>/`; service-log discovery reports local npm paths, Docker Compose log commands, and systemd journal commands where applicable.

## Sharp Edges

- OAuth or ChatGPT auth caches are sensitive and may expire or be workspace-bound. Production automation should prefer API key auth unless the operator intentionally configures trusted local OAuth.
- Tmux is useful for visibility but cannot be the source of workflow state.
- OpenClaw TaskFlow can help, but Forge Controller must still own Forge-specific task truth.
- Forge artifact state and process exit state can diverge; the watcher must reconcile both.
- Multi-repo operation is safe only with per-repo locks and explicit user permissions.

## Architecture Questions

- Production persistence remains a final hardening risk because the current workflow store is still in-memory.
