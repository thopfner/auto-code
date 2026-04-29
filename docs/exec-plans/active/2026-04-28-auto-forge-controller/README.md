# Auto Forge Controller Implementation Brief

BRIEF_ID: `2026-04-28-auto-forge-controller`
Pack type: `brief-full`
Status: `PHASE_5_REVISION_REQUIRED`
Current authorized window: `72-phase-5-revision-one-command-vps-installer.md` only

## Scope

Build Auto Forge Controller as a deployable product that can be pulled from GitHub onto a fresh VPS, configured through a web onboarding UI, connected to a Telegram bot and OpenClaw gateway, and used to run the Forge workflow end to end.

## Production-Grade Acceptance Bar

This is not a prototype, demo, or beta scaffold. The accepted final implementation must be deployable and operable by the user on a new VPS without hand-editing internal code.

Production-grade means:

- one-command bootstrap after `git clone`
- guided web onboarding for Telegram, OpenClaw, Codex auth, repos, users, and runner profiles
- durable controller state in production, with migrations and backup/restore
- deterministic task state machine for scope, plan, worker, QA, revision, replan, blocker, and final closeout
- per-repo mutating execution locks
- machine-readable logs and artifact validation
- real OpenClaw/Telegram integration path, not only mocked adapters
- fake adapters for deterministic automated tests
- documented local desktop and VPS install paths
- systemd and Docker Compose deployment support
- secure secret handling and no committed auth caches
- final E2E proof from Telegram `/scope` through completed Forge closeout

Source of truth: approved user requirements, current Forge skill contract, repo-local memory, OpenAI Codex docs for automation/auth behavior, OpenClaw docs for Telegram, TaskFlow, ACP, and webhooks, and Telegram Bot API docs.

## Hard Rules

- Do not modify `/opt/forge-skills`.
- Use the repo-local Auto Forge skills named `auto-forge-*` under `.agents/skills/forge-*` plus shared references under `.agents/skills/references/` for this project.
- Do not create `git worktree` directories, sibling clones, or duplicate repo folders.
- Do not use tmux as durable workflow state.
- Do not commit `.env`, Codex auth caches, Telegram tokens, OpenClaw tokens, or private keys.
- Do not start later phases until QA clears the previous checkpoint and provides the next handoff.
- Do not reduce the final go-live bar to “core works, ops later.”

## Execution Order

1. `10-phase-1-foundation.md` - choose/prove stack, state model, runner abstraction, and project skeleton.
2. `20-phase-2-openclaw-telegram-onboarding.md` - build onboarding UI and OpenClaw/Telegram integration.
3. `30-phase-3-codex-forge-engine.md` - implement Forge workflow engine and artifact watcher.
4. `40-phase-4-portability-ops.md` - deployment, portability, multi-repo/user ops, backup/recovery.
5. `50-phase-5-e2e-hardening.md` - end-to-end hardening, documentation, and go-live proof.
6. `90-final-qa-and-merge-gate.md` - final verification and closeout.
7. `99-memory-pack-update.md` - memory update and active-to-completed archive.

## Phase Gates

- Phase 1: `QA_CHECKPOINT`
- Phase 2: `QA_CHECKPOINT`
- Phase 3: `QA_CHECKPOINT`
- Phase 4: `QA_CHECKPOINT`
- Phase 5: `FINAL_SHIPGATE`

Each checkpoint requires a timestamped report under `reports/`, refreshed `reports/LATEST.md`, full 40-character commit IDs, and pushed branch state unless explicitly blocked.

## Required Output From The Coding Agent

Every stop report must include:

- phase addressed
- branch and repo path confirmation
- files changed
- tests/checks run
- implementation commit SHA
- stop/report commit SHA
- push status
- blockers or residual risks
- durable memory candidates

## Definition Of Done

Final done means the user can clone the repo onto a new VPS, complete browser onboarding, connect a new Telegram bot and OpenClaw gateway, register a repo, issue `/scope`, and see the task complete through Forge final closeout.

## Brief Lineage Summary

This is the first implementation brief for the project. It was created after research and user approval of the custom Forge Controller architecture.

## Target GitHub Branch And Repo-Path Summary

- Active repo path: `/var/www/html/auto.thapi.cc`
- Target branch: `main`
- No duplicate repo path or `git worktree` is authorized.

## Autonomy Model

Phase 1, Phase 2, Phase 3, and Phase 4 are cleared. Phase 5 deterministic proof landed. `55-phase-5-revision-vps-setup-wizard.md` and `56-phase-5-revision-env-file-flag.md` are accepted. `59-phase-5-revision-openclaw-bootstrap.md` removed the normal OpenClaw token prompt. `61-phase-5-revision-openclaw-fail-closed.md` is accepted subject to live external validation. `64-phase-5-revision-managed-codex-cli.md` made Codex CLI a repo-managed dependency and is accepted subject to live external validation. `68-phase-5-revision-setup-wizard-ux-smoothing.md` fixed Telegram discovery retry/manual fallback and Codex OAuth device-auth. `72-phase-5-revision-one-command-vps-installer.md` materially improved fresh VPS launch but QA found installer UX/auth polish blockers. `74-phase-5-revision-installer-ux-auth-polish.md` is authorized now. Phase 5 remains the final shipgate and must stop for QA before memory update and archive closeout can complete.
