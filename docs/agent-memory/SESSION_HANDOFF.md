# Auto Forge Controller Session Handoff

Last refreshed: 2026-04-30

## Start Here

- `README.md`
- `AGENTS.md`
- `docs/agent-memory/PROJECT.md`
- `docs/agent-memory/ARCHITECTURE.md`
- `docs/agent-memory/CURRENT_STATE.md`
- `docs/agent-memory/TESTING.md`
- `docs/exec-plans/active/2026-04-29-codex-runtime-deployment-hardening/README.md`

## Current Objective

Build Auto Forge Controller as a deployable product that lets the operator run the Forge workflow from Telegram through OpenClaw.

## Repository Identity

- Local repo path: `/var/www/html/auto.thapi.cc`
- GitHub repository: `thopfner/auto-code`
- Git remote: `git@github-auto-forge:thopfner/auto-code.git`
- Product name: `auto-forge-controller`

## Important Context

- `/var/www/html/auto.thapi.cc` is the source/dev checkout. The product is deployed by pushing to GitHub and pulling into a separate target install, commonly `/opt/auto-forge-controller` on the deployment VPS.
- Do not treat service restart or Compose validation in this source checkout as the deployed product running. Local Compose here is disposable proof only and must be cleaned down.
- The existing global Forge skillset must not be modified.
- Repo-local Auto Forge skills named `auto-forge-*` exist under `.agents/skills/forge-*` plus shared references under `.agents/skills/references/`.
- The intended product is not a beta scaffold; final acceptance requires end-to-end deployment and Telegram-triggered workflow proof.
- OpenClaw is a local gateway/helper; the controller owns durable Forge orchestration state and the shared Telegram inbound webhook.
- Managed OpenClaw bootstrap, Telegram repo registry/switching, selected-repo `/scope`, repo-scoped SSH deploy-key management, Postgres-backed deployed workflow state, and `/task retry` are implemented and locally verified.

## Next Action

Continue the active Codex runtime deployment hardening brief at `docs/exec-plans/active/2026-04-29-codex-runtime-deployment-hardening/`.

- Phase 1 is cleared.
- Phase 2 source repairs through durable workflow state and `/task retry` are ready for target validation.
- Before any deployed-service proof, push the source branch and pull the exact commit into the target install.

## Do Not Do

- Do not create duplicate repo folders or `git worktree` directories.
- Do not self-clear QA checkpoints or final shipgates. They must stop for external QA.
- Do not restart or leave long-lived product services running from `/var/www/html/auto.thapi.cc` unless the operator explicitly designates this path as the runtime target.
- Do not rely on tmux as workflow state.
- Do not hardcode secrets or commit auth caches.

## External Blocker

`npm run live:smoke` currently reports `BLOCKED_EXTERNAL` because staged/live `OPENCLAW_BASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_TEST_CHAT_ID`, and `OPENAI_API_KEY` are not present in the shell. API-key mode needs `OPENAI_API_KEY`; OAuth mode needs a completed Codex device-auth cache and `CODEX_AUTH_REF=secret:codex-oauth-local-cache`. Real deploy-key proof also needs a disposable GitHub SSH remote and suitable GitHub deploy-key setup access.
