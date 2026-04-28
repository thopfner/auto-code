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

Provide staged or live Telegram/OpenClaw/OpenAI credentials, rerun `npm run live:smoke`, then run final QA against `90-final-qa-and-merge-gate.md`. Phase 5 local FULL_REBUILD and deterministic fixture E2E proof are complete, but the live external gate is blocked by missing credentials.

## Do Not Do

- Do not create duplicate repo folders or `git worktree` directories.
- Do not self-clear Phase 5. It is the final shipgate and must stop for QA before memory update and archive closeout.
- Do not rely on tmux as workflow state.
- Do not hardcode secrets or commit auth caches.

## External Blocker

`npm run live:smoke` currently reports `BLOCKED_EXTERNAL` because `OPENCLAW_BASE_URL`, `OPENCLAW_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_TEST_CHAT_ID`, and `OPENAI_API_KEY` are not present in the shell.
