# Auto Forge Controller Project Memory

Last refreshed: 2026-04-29

## Mission

Auto Forge Controller turns the manual Forge workflow into a portable, deployable automation product. The operator should work primarily from Telegram while OpenClaw and the controller coordinate Codex scope, planning, implementation, QA, and final closeout.

## Repository Identity

- Local repo path: `/var/www/html/auto.thapi.cc`
- GitHub repository: `thopfner/auto-code`
- Git remote: `git@github-auto-forge:thopfner/auto-code.git`
- Product name: `auto-forge-controller`

## Deployment Topology

- `/var/www/html/auto.thapi.cc` is the source/dev checkout used for planning, coding, QA, memory, and brief continuity.
- The product is deployed by pushing this repository to GitHub and pulling it into a separate target install, commonly `/opt/auto-forge-controller` on the deployment VPS.
- Do not treat this dev VPS as the long-lived product runtime unless the operator explicitly says the target install is this same path.
- Docker Compose checks in this dev checkout are disposable build/smoke validation only; they must use alternate ports when needed and be cleaned down after proof.
- Production or go-live claims require verification on the target deployed checkout after it has pulled the pushed GitHub commit.

## In Scope

- Web onboarding UI for new VPS installs, Telegram bots, OpenClaw gateway connection, Codex auth, repo registration, users, and runner profiles.
- Durable controller service with queueing, state machine, repo locks, runner orchestration, artifact watchers, audit logs, and recovery commands.
- OpenClaw integration for Telegram slash command ingress and Telegram status or approval egress.
- Codex runner integration for Forge scope, plan, worker, and QA roles.
- Multi-repo and multi-user operation.
- Portable local desktop and VPS deployment.
- Production runbooks, install docs, health checks, backups, and end-to-end go-live verification.

## Out Of Scope

- Modifying the global Forge skillset under `/opt/forge-skills`.
- Replacing OpenClaw as the Telegram-facing gateway.
- Creating duplicate repo checkouts or `git worktree` directories as part of normal Forge execution.
- Merging to `main`, opening PRs, or choosing a landing strategy unless explicitly requested by an operator workflow.
- Treating tmux as the durable orchestration source of truth.

## Primary Workflows

- New install: pull the repo, run bootstrap, open onboarding, connect Telegram/OpenClaw/Codex, register repos and users.
- Task intake: operator sends `/scope` in Telegram, answers clarification questions, and approves deep planning decisions.
- Automated execution: controller runs Forge scope, plan, worker, QA, revision, and final closeout steps in sequence.
- Operations: operator checks queue, pauses/resumes repos, cancels tasks, recovers stuck runs, and reviews logs through Telegram and the web UI.
- Portability: operator exports config and installs the same product on another VPS or local desktop.

## Constraints

- Telegram/OpenClaw remains the human-facing control plane.
- Controller owns durable workflow state.
- Codex automation should use non-interactive, machine-readable execution where possible.
- The VPS installer supports both Codex ChatGPT OAuth device auth and API-key auth. OAuth is acceptable for the noobie VPS path when the host Codex auth cache is protected and mounted read-only into the worker container.
- Every repo has a serialized implementation queue unless a future brief explicitly designs safe parallel branch ownership.
- Validation-level labels describe the required class of proof, not permission to turn this dev checkout into the deployed runtime. `SERVICE_RESTART` in this repo means a service-scoped disposable local validation when appropriate; deployed service restarts belong on the target install only.

## Non-Negotiable Invariants

- Do not mutate `/opt/forge-skills`; use the repo-local Auto Forge skills named `auto-forge-*` under `.agents/skills/forge-*` plus shared references under `.agents/skills/references/`.
- A task cannot advance past a Forge `QA_CHECKPOINT` or `FINAL_SHIPGATE` without a QA/controller clearance event.
- A repo path can have only one active mutating worker window at a time.
- Every task transition must be auditable from DB state plus run logs plus Forge artifacts.
- Never screen-scrape a TUI as the primary automation mechanism.
- Every go-live claim must be backed by an end-to-end Telegram-triggered run.

## External Dependencies

- Telegram Bot API.
- OpenClaw gateway and Telegram channel integration.
- Codex CLI, Codex SDK, or Codex MCP server.
- Git and SSH for target repos.
- Postgres for production durable state.
- Docker Compose and systemd for deployment.

## Definition Of Done

The project is done when a fresh VPS can pull this repo, run onboarding, connect a new Telegram bot and OpenClaw gateway, register at least one repo, run `/scope`, and complete a full Forge lifecycle through final memory closeout and completed brief archive with clean logs and recoverable state.

## Open Questions

- Final implementation stack is delegated to the active brief, with a bias toward TypeScript/Node for OpenClaw and Codex SDK fit unless live repo inspection justifies another choice.
