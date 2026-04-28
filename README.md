# Auto Forge Controller

Auto Forge Controller is the product repo for turning the manual Forge workflow into a deployable automation system.

The intended production flow is:

```text
Telegram command
  -> OpenClaw gateway
  -> Auto Forge Controller
  -> Codex scope / planning / worker / QA runs
  -> Forge reports, automation state, git commits, and Telegram status updates
```

## Product Goal

Build a portable controller that can be pulled onto any VPS, launched through a guided web onboarding experience, connected to a new Telegram bot and OpenClaw gateway, and then used to run Forge task pipelines end to end.

This repository vendors a repo-local copy of the Forge skillset under `.agents/skills/forge-*` plus `.agents/skills/references/` so this project can evolve its own automation contract without modifying `/opt/forge-skills`.

## Current State

This repo is initialized as the product planning and execution home. The active implementation brief is:

- `docs/exec-plans/active/2026-04-28-auto-forge-controller/`

Coding agents should start from that brief, not from chat history.

## Required End State

The accepted implementation must be a pull-ready product with:

- a web onboarding UI for OpenClaw, Telegram, Codex auth, repos, users, and runner profiles
- a durable Forge Controller service with queue, task state machine, repo locks, and run audit logs
- Telegram slash commands routed through OpenClaw
- role-specific Codex execution for scope, planning, implementation, and QA
- Forge artifact watching for `reports/LATEST.*`, `automation/state.json`, `automation/qa.json`, git branch, pushed commits, and brief archive state
- multi-repo and multi-user setup
- local desktop and VPS deployment paths
- systemd, Docker Compose, health checks, backup/restore, and stuck-run recovery docs
- an end-to-end go-live test from `/scope` through final Forge closeout

## Operator Commands

Planned Telegram command surface:

- `/scope` starts a new scoped task.
- `/status` shows the active task or queue.
- `/queue` lists pending tasks.
- `/approve` approves a waiting planning or QA decision.
- `/pause` pauses a task or repo queue.
- `/resume` resumes a paused task or repo queue.
- `/cancel` cancels a task safely.
- `/repos` lists configured repos.
- `/help` shows the command contract.

## Deployment Contract

The implementation must support:

1. Pull repo on a new VPS.
2. Run one bootstrap command.
3. Open web onboarding.
4. Configure Telegram bot token.
5. Configure or launch OpenClaw gateway.
6. Configure Codex auth and runner profiles.
7. Register one or more Git repos.
8. Send `/scope` in Telegram.
9. Watch the task move through scope, plan, worker, QA, and final closeout.

The project is not go-live ready until the final execution brief shipgate proves this sequence.

