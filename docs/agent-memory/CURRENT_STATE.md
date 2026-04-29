# Auto Forge Controller Current State

Last refreshed: 2026-04-28

## Current Branch

- `main`

## Repository Identity

- Local repo path: `/var/www/html/auto.thapi.cc`
- GitHub repository: `thopfner/auto-code`
- Git remote: `git@github-auto-forge:thopfner/auto-code.git`
- Product name: `auto-forge-controller`

## Active Work

- New product repo initialized at `/var/www/html/auto.thapi.cc`.
- Repo-local Auto Forge skills named `auto-forge-*` exist under `.agents/skills/forge-*` plus shared references under `.agents/skills/references/`.
- Active execution brief: `docs/exec-plans/active/2026-04-28-auto-forge-controller/`.
- Phase 4 implementation and health/log revision are cleared.
- Phase 5 implementation is at final shipgate stop with local deterministic E2E and FULL_REBUILD proof complete.
- Current QA status: `BLOCKED_EXTERNAL` until live or staged Telegram/OpenClaw/OpenAI credentials are provided and `npm run live:smoke` passes.

## Recently Completed

- Created repo-local memory pack and UI docs.
- Captured the approved architecture direction: custom Forge Controller with Telegram/OpenClaw as the interface layer.
- Added service skeletons for API, worker, web, and CLI; core task state machine; repo locks; runner and operator gateway interfaces; fake runner/OpenClaw adapters; initial SQL migration; and unit/config/schema checks.
- Added setup API endpoints, first-run onboarding UI, Telegram Bot API adapter, OpenClaw gateway adapter, secret-reference setup persistence, and tests for onboarding/API/adapters.
- Added the Forge workflow engine for `/scope`, clarification pause/resume, planning approval, worker dispatch, QA routing, revision/replan/block/complete outcomes, cancellation, and runner retry.
- Added the Codex CLI runner adapter for `codex-cli 0.125.0`, prompt builder, in-memory workflow store, artifact watcher, Telegram approval/resume API endpoints, and worker startup wiring.
- Corrected Phase 3 revision issues: Codex runner uses `--config approval_policy="..."`, artifact-derived QA outcomes enforce required full commit SHAs, and `REVISION_PACK_REQUIRED` routes to worker revision.
- Added Docker Compose services for Postgres/API/worker/web, systemd API/worker unit templates, `scripts/bootstrap.sh`, deployment runbooks, ops CLI commands, health checks, worker heartbeat, references-only backup/restore, recovery logging, and task/service log discovery.
- Corrected Phase 4 revision issues: health reports API, web, worker, database, OpenClaw, and Codex checks; service logs are discoverable for API, worker, web, and Postgres.
- Added Phase 5 deterministic E2E coverage for fresh install docs, onboarding validation, `/scope` intake, clarification and planning approvals, worker/QA revision, final completion, operator summaries, and pushed fixture repo artifact validation.
- Added `npm run full-rebuild` for bootstrap, verify, install-check, health, backup/restore, recovery, log discovery, Docker Compose build/up/smoke, and cleanup.
- Added `npm run live:smoke` for staged or live Telegram/OpenClaw/Codex validation with explicit `BLOCKED_EXTERNAL` output when credentials are missing.
- Made Codex CLI a repo-managed dependency with `@openai/codex@0.125.0`; runtime and health resolve explicit `CodexCliRunnerOptions.codexBin`, then `CODEX_CLI_COMMAND`, then `node_modules/.bin/codex`.

## Known Risks

- Production auth handling needs careful implementation because Codex auth caches and Telegram/OpenClaw secrets are sensitive.
- Real OpenClaw, Telegram, and OpenAI Codex runner smoke is blocked in this shell because staged/live external values are missing.
- The VPS installer supports Codex ChatGPT OAuth device auth and API-key auth. OAuth writes `CODEX_AUTH_REF=secret:codex-oauth-local-cache` and mounts the host Codex auth cache into the worker container; API-key auth writes `CODEX_AUTH_REF=env:OPENAI_API_KEY`.
- `OPENCLAW_SETUP_MODE=install-or-onboard` now installs OpenClaw when missing, initializes `gateway.mode=local` without launching OpenClaw's interactive onboarding, attempts gateway install/start/status, adds a system-level `/etc/systemd/system/openclaw-gateway.service` fallback when OpenClaw's own service path does not produce a healthy gateway, accepts the explicit installer gateway URL when OpenClaw status omits a URL field, and only then falls back to `configure-later`.

## Next Best Step

- Provide staged or live Telegram/OpenClaw/OpenAI credentials, rerun `npm run live:smoke`, then run final QA against `90-final-qa-and-merge-gate.md`. Do not self-clear Phase 5.
