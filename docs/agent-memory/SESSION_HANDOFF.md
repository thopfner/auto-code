# Auto Forge Controller Session Handoff

Last refreshed: 2026-04-28

## Start Here

- `README.md`
- `AGENTS.md`
- `docs/agent-memory/PROJECT.md`
- `docs/agent-memory/ARCHITECTURE.md`
- `docs/agent-memory/CURRENT_STATE.md`
- `docs/agent-memory/TESTING.md`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/README.md`

## Current Objective

Build Auto Forge Controller as a deployable product that lets the operator run the Forge workflow from Telegram through OpenClaw.

## Important Context

- The existing global Forge skillset must not be modified.
- Repo-local Auto Forge skills named `auto-forge-*` exist under `.agents/skills/forge-*` plus shared references under `.agents/skills/references/`.
- The intended product is not a beta scaffold; final acceptance requires end-to-end deployment and Telegram-triggered workflow proof.
- OpenClaw is the interface and trigger layer; the controller owns durable Forge orchestration state.

## Next Action

Execute Phase 1 of the active brief: choose and prove the implementation stack, create the controller foundation, and lock down the runner interface.

## Do Not Do

- Do not create duplicate repo folders or `git worktree` directories.
- Do not start with UI-only work before the durable controller state model exists.
- Do not rely on tmux as workflow state.
- Do not hardcode secrets or commit auth caches.
