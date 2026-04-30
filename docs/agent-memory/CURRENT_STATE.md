# Auto Forge Controller Current State

Last refreshed: 2026-04-29

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
- Active execution brief: `docs/exec-plans/active/2026-04-29-codex-runtime-deployment-hardening/`.
- Current authorized phase: `20-phase-2-observability-health-and-installer-semantics.md`.
- Current QA status: Phase 1 is cleared; Phase 2 implementation is authorized and may be in progress.
- Source/dev checkout: `/var/www/html/auto.thapi.cc`. This is not the long-lived deployed product runtime unless the operator explicitly says so.
- Deployment target for product proof is a separate GitHub-pulled install, commonly `/opt/auto-forge-controller` on the target VPS.
- Local Compose checks in this source checkout are disposable validation only and must be cleaned down after proof.

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
- Added managed OpenClaw bootstrap via `scripts/setup-openclaw.sh` and `packages/ops/src/openclaw-bootstrap.ts`; the VPS installer calls it during `OPENCLAW_SETUP_MODE=install-or-onboard`.
- Added Auto Forge-managed OpenClaw workspace templates for `AGENTS.md`, `SOUL.md`, `USER.md`, `IDENTITY.md`, `TOOLS.md`, and `HEARTBEAT.md`.
- Preserved Auto Forge ownership of Telegram inbound traffic at `${AUTO_FORGE_PUBLIC_BASE_URL}/telegram/webhook`; OpenClaw Telegram ownership is disabled for the shared bot path.
- Added Telegram repo registry commands for `/repos`, `/repo add-path`, `/repo clone`, `/repo use`, `/repo pause`, `/repo resume`, and selected-repo `/scope @alias ...` routing with allowed-root and symlink escape protections.
- Added repo-scoped Ed25519 SSH deploy-key management through `/repo key create`, `/repo key show`, `/repo key test`, `/repo key github-add`, and `/repo git-test`.
- SSH private keys are stored under `AUTO_FORGE_SSH_KEY_ROOT` or `/etc/auto-forge-controller/ssh` with private key mode `0600`; Telegram/API output exposes only public key, fingerprint, and setup instructions.
- GitHub deploy-key API creation uses `AUTO_FORGE_GITHUB_TOKEN` or `GITHUB_TOKEN`, defaults deploy keys to read-only, and requires `--write` for write access.
- Added `/repo github-setup <alias>` for Telegram-guided GitHub deploy-key onboarding, and SSH deploy-key checks now convert GitHub HTTPS remotes to `git@github.com:owner/repo.git` for read and write dry-run validation.
- The deployed `auto-forge-controller` checkout is a system harness, not the implicit product target. Operators must register/select a product repo before normal `/scope` work; `/repo clone <alias> <git-url> [absolute-project-path]` can place a new product checkout under an allowed VPS project folder such as `/data/repos/<alias>`.

## Known Risks

- Dev/source versus deployed-target topology can drift if agents interpret Forge "VPS repo path" language too broadly. Always distinguish `/var/www/html/auto.thapi.cc` source work from target install proof before service restarts or go-live claims.
- Production auth handling needs careful implementation because Codex auth caches and Telegram/OpenClaw secrets are sensitive.
- Real OpenClaw, Telegram, GitHub deploy-key, and OpenAI Codex runner smoke is blocked in this shell because staged/live external values are missing.
- The VPS installer supports Codex ChatGPT OAuth device auth and API-key auth. OAuth writes `CODEX_AUTH_REF=secret:codex-oauth-local-cache` and mounts the host Codex auth cache into the worker container; API-key auth writes `CODEX_AUTH_REF=env:OPENAI_API_KEY`.
- `OPENCLAW_SETUP_MODE=install-or-onboard` now installs OpenClaw when missing, initializes `gateway.mode=local` without launching OpenClaw's interactive onboarding, attempts gateway install/start/status, adds a system-level `/etc/systemd/system/openclaw-gateway.service` fallback when OpenClaw's own service path does not produce a healthy gateway, accepts the explicit installer gateway URL when OpenClaw status omits a URL field, and only then falls back to `configure-later`.
- The one-command installer keeps OpenClaw Telegram ownership disabled for the shared Auto Forge bot path; Auto Forge registers and verifies the Telegram webhook directly.
- `npm run live:smoke` can optionally validate OpenClaw CLI Telegram delivery with `openclaw message send --channel telegram`, but controller Telegram replies use direct Bot API delivery by default.
- `npm run live:smoke` treats OpenClaw CLI Telegram delivery as optional by default because controller Telegram replies use direct Bot API delivery; set `AUTO_FORGE_REQUIRE_OPENCLAW_TELEGRAM_DELIVERY=1` for strict OpenClaw CLI delivery diagnostics.
- Controller Telegram commands and workflow notifications use direct Telegram Bot API delivery. Webhook commands authorize the saved `TELEGRAM_TEST_CHAT_ID`, and the installer now persists discovered `TELEGRAM_OPERATOR_CHAT_ID`/`TELEGRAM_OPERATOR_USER_ID` automatically for group/private chat identity mismatches.
- The installer registers Telegram inbound webhooks at `/telegram/webhook` for HTTPS public URLs with Telegram's secret header, and Vite allows the deployment hostname from `AUTO_FORGE_PUBLIC_BASE_URL`.
- HTTPS installs default Certbot on when nginx is enabled, and live smoke verifies public `/live` plus web reachability whenever `AUTO_FORGE_PUBLIC_BASE_URL` is set.
- The installer reuses existing runtime env defaults on reruns, including Telegram token, chat ID, webhook secret, public URL, OpenClaw URL, and OpenAI API key, and avoids `getUpdates` discovery when Telegram already has an active webhook.
- Public deployment URL remains runtime-provided through `AUTO_FORGE_PUBLIC_BASE_URL` or the installer prompt; no deployment hostname is hardcoded into the OpenClaw/repo-management path.
- GitHub push onboarding is now an operator-managed Telegram path; missing deploy keys, missing API tokens, or failed dry-run pushes should return actionable `/repo github-setup`, `/repo key create`, `/repo key github-add --write`, and `/repo git-test` next steps rather than a generic QA blocker.
- `/scope` without a selected product repo should return product-repo onboarding guidance rather than silently targeting the controller checkout. The controller repo may still exist in `/repos` as `system/controller` for transparency.

## Next Best Step

- Continue or QA the active Codex runtime deployment hardening brief. Phase 2 should improve observability, health path truth, installer live-smoke semantics, and test timing without treating this dev checkout as the deployed runtime.
- Later deployed proof must pull the pushed GitHub commit into the target install before running service restart, Docker Compose, Telegram, OpenClaw, or Codex go-live validation.
