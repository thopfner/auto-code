# Auto Forge Controller Project Memory

Last refreshed: 2026-04-28

## Mission

Auto Forge Controller turns the manual Forge workflow into a portable, deployable automation product. The operator should work primarily from Telegram while OpenClaw and the controller coordinate Codex scope, planning, implementation, QA, and final closeout.

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
- API key auth is preferred for unattended automation; ChatGPT/OAuth auth is allowed only on a trusted locked-down machine with explicit credential protections.
- Every repo has a serialized implementation queue unless a future brief explicitly designs safe parallel branch ownership.

## Non-Negotiable Invariants

- Do not mutate `/opt/forge-skills`; use the repo-local clone under `.agents/skills/forge-*` plus `.agents/skills/references/`.
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

