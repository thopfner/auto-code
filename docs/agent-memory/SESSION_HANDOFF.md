# Auto Forge Controller Session Handoff

Last refreshed: 2026-04-29

## Start Here

- `README.md`
- `AGENTS.md`
- `docs/agent-memory/PROJECT.md`
- `docs/agent-memory/ARCHITECTURE.md`
- `docs/agent-memory/CURRENT_STATE.md`
- `docs/agent-memory/TESTING.md`
- `docs/exec-plans/active/2026-04-29-openclaw-bootstrap-repo-management/README.md`

## Current Objective

Build Auto Forge Controller as a deployable product that lets the operator run the Forge workflow from Telegram through OpenClaw.

## Repository Identity

- Local repo path: `/var/www/html/auto.thapi.cc`
- GitHub repository: `thopfner/auto-code`
- Git remote: `git@github-auto-forge:thopfner/auto-code.git`
- Product name: `auto-forge-controller`

## Important Context

- The existing global Forge skillset must not be modified.
- Repo-local Auto Forge skills named `auto-forge-*` exist under `.agents/skills/forge-*` plus shared references under `.agents/skills/references/`.
- The intended product is not a beta scaffold; final acceptance requires end-to-end deployment and Telegram-triggered workflow proof.
- OpenClaw is a local gateway/helper; the controller owns durable Forge orchestration state and the shared Telegram inbound webhook.
- Managed OpenClaw bootstrap, Telegram repo registry/switching, selected-repo `/scope`, and repo-scoped SSH deploy-key management are implemented and locally verified.

## Next Action

Provide staged/live Telegram, OpenClaw, OpenAI, and GitHub deploy-key proof inputs, then rerun the Phase 4 final shipgate proof from `docs/exec-plans/active/2026-04-29-openclaw-bootstrap-repo-management/40-phase-4-integration-proof.md`. Local `npm run verify` and `npm run full-rebuild` passed on 2026-04-29, but `npm run live:smoke` reported `BLOCKED_EXTERNAL` because credentials are absent in this shell.

## Do Not Do

- Do not create duplicate repo folders or `git worktree` directories.
- Do not self-clear the Phase 4 final shipgate. It must stop for external QA.
- Do not rely on tmux as workflow state.
- Do not hardcode secrets or commit auth caches.

## External Blocker

`npm run live:smoke` currently reports `BLOCKED_EXTERNAL` because staged/live `OPENCLAW_BASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_TEST_CHAT_ID`, and `OPENAI_API_KEY` are not present in the shell. API-key mode needs `OPENAI_API_KEY`; OAuth mode needs a completed Codex device-auth cache and `CODEX_AUTH_REF=secret:codex-oauth-local-cache`. Real deploy-key proof also needs a disposable GitHub SSH remote and suitable GitHub deploy-key setup access.
