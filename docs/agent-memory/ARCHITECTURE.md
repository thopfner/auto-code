# Auto Forge Controller Architecture Memory

Last refreshed: 2026-04-29

## Target System Map

- Web app and onboarding UI: guides installation, validates OpenClaw, Telegram, Codex, repo access, users, and runner profiles.
- Controller API: receives Telegram webhooks and optional OpenClaw gateway events, exposes admin/status endpoints, and owns task transitions.
- Queue and scheduler: serializes repo work, dispatches Codex runs, and resumes waiting tasks after approvals.
- Runner layer: launches role-specific Codex sessions for scope, plan/QA, and worker execution.
- Artifact watcher: reads Forge reports, automation JSON, git branch, commit SHAs, push status, and brief archive state.
- Notification layer: sends Telegram status, questions, approvals, blockers, and closeout summaries through the controller Telegram adapter, with OpenClaw available for helper diagnostics.
- Operations layer: health checks, logs, backups, recovery commands, and systemd/Docker Compose deployment.

## Deployment Topology

- Source/dev checkout: `/var/www/html/auto.thapi.cc` on this server. Agents write code, briefs, reports, and memory here, then push to `git@github-auto-forge:thopfner/auto-code.git`.
- Target deployed checkout: a separate install that pulls from GitHub, commonly `/opt/auto-forge-controller` on the deployment VPS.
- Runtime architecture facts must distinguish dev proof from deployed proof. Local Compose runs in the source checkout are temporary validation harnesses, not evidence that the product is running in production.
- Service restart, Docker Compose recreate, nginx/systemd, live Telegram, OpenClaw, and Codex go-live proof must run against the target deployed checkout after the relevant pushed Git commit is present there, unless the operator explicitly designates this repo path as the target runtime.

## Planned Entry Points

- `web` service: browser onboarding and operator dashboard.
- `api` service: controller HTTP API and OpenClaw webhook endpoint.
- `worker` service: queue consumer and Codex runner supervisor.
- `watcher` service or worker role: artifact and git-state reconciliation.
- `cli` command: local admin, bootstrap, backup, restore, health, and repair workflows.
- `scripts/setup-openclaw.sh`: managed OpenClaw workspace bootstrap called by the VPS installer.

## Data Flow

```text
Telegram /scope
  -> Telegram Bot API webhook
  -> Auto Forge controller
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
- Repo registrations track aliases, validated paths under allowed roots, optional SSH remotes, pause state, and audit events.
- Repo-scoped SSH deploy keys live under `AUTO_FORGE_SSH_KEY_ROOT` or `/etc/auto-forge-controller/ssh` and are referenced by repo registration; private key material stays on disk.

## External Integrations

- OpenClaw gateway: local gateway/helper, health integration, and optional outbound diagnostics.
- Telegram Bot API: slash command menu, message delivery, callback buttons, and controller-owned webhook at `/telegram/webhook`.
- Codex CLI: current Phase 3 runner adapter uses `codex exec --json --config approval_policy="..." --output-last-message ...` and supports read-only runner smoke with installed `codex-cli 0.125.0`.
- Git/SSH: repo state, commits, deploy-key-backed `git ls-remote`, push dry-run validation, pushes, and artifact verification.
- GitHub Deploy Keys API: optional deploy-key registration using `AUTO_FORGE_GITHUB_TOKEN` or `GITHUB_TOKEN`; keys are read-only unless `--write` is explicit.

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

## OpenClaw And Repo Management Contracts

- The VPS installer calls managed OpenClaw bootstrap during `OPENCLAW_SETUP_MODE=install-or-onboard`.
- Managed OpenClaw workspace files are generated from repo templates for `AGENTS.md`, `SOUL.md`, `USER.md`, `IDENTITY.md`, `TOOLS.md`, and `HEARTBEAT.md`.
- Auto Forge owns Telegram inbound webhook traffic for the shared bot. OpenClaw must not long-poll or set a competing webhook for that bot path.
- Telegram repo switching uses registered aliases only, validates realpaths under allowed roots, rejects symlink escapes, and blocks switching when the current repo has a mutating task.
- `/scope` routes to the active repo unless the operator supplies an explicit `@alias`.
- Repo SSH key generation creates per-repo Ed25519 keys, enforces private key mode `0600`, and never returns private key material through Telegram/API responses.

## Sharp Edges

- OAuth or ChatGPT auth caches are sensitive and may expire or be workspace-bound. The VPS installer can intentionally configure trusted local OAuth by writing `CODEX_AUTH_REF=secret:codex-oauth-local-cache` and mounting the protected host Codex auth cache read-only into the worker container; API-key auth remains available through `CODEX_AUTH_REF=env:OPENAI_API_KEY`.
- Forge skill wording may say "VPS repo path" for both source and target. In this project, always resolve that ambiguity before restart/deploy proof: `/var/www/html/auto.thapi.cc` is the dev/source checkout unless explicitly reclassified by the operator.
- Tmux is useful for visibility but cannot be the source of workflow state.
- OpenClaw TaskFlow can help, but Forge Controller must still own Forge-specific task truth.
- Forge artifact state and process exit state can diverge; the watcher must reconcile both.
- Multi-repo operation is safe only with per-repo locks and explicit user permissions.
- The final clean VPS proof still requires staged/live external credentials and a disposable GitHub SSH remote with deploy-key access.

## Architecture Questions

- Production persistence remains a final hardening risk because the current workflow store is still in-memory.
