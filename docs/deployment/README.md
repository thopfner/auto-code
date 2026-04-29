# Auto Forge Deployment

Auto Forge Controller supports two deployment paths:

- Local desktop: `scripts/bootstrap.sh`, then start API, worker, and web services with npm.
- VPS: run the one-command installer, which installs prerequisites, writes runtime setup, starts Docker Compose, configures nginx/TLS when selected, and runs health/smoke gates.

Both paths keep secrets out of Git. `.env` is local-only, backup bundles store secret references such as `env:OPENAI_API_KEY`, and raw Telegram/Codex credentials must live in the operator shell, Docker secret manager, or `/etc/auto-forge-controller/auto-forge.env`. OpenClaw gateway auth is normally discovered or managed by OpenClaw; explicit webhook auth references are only for advanced installs. Codex CLI is a repo-managed dependency installed by `npm ci` at `node_modules/.bin/codex`; use `CODEX_CLI_COMMAND` only when intentionally overriding that managed binary.

## Required Commands

```bash
curl -fsSL https://raw.githubusercontent.com/thopfner/auto-code/main/scripts/install-vps.sh | sudo bash
npm run install:vps
scripts/bootstrap.sh
npm run setup:vps
npm run ops:health
npm run ops:backup -- --dry-run
npm run ops:restore -- --input backups/example.json --dry-run
npm run ops:install-check
npm run full-rebuild
npm run live:smoke
```

`scripts/install-vps.sh` is the primary fresh-VPS path. It supports curl-pipe and repo-local execution, verifies Ubuntu, installs missing git/curl/Node/Docker prerequisites, runs bootstrap in installer-aware mode, creates `/etc/auto-forge-controller/auto-forge.env` with mode `0600`, writes references-only setup JSON into the Compose-mounted data directory, builds and starts Postgres/API/worker/web, installs nginx when selected, defaults Certbot on for HTTPS public URLs, verifies public `/live` and web reachability, registers the Telegram webhook at `/telegram/webhook` with Telegram's secret header, then runs Compose health/smoke and `npm run live:smoke`. Telegram discovery persists both the selected chat ID and discovered operator user ID so group/private chat authorization is installer-owned. The installer supports Codex ChatGPT OAuth through device auth or API-key auth through `OPENAI_API_KEY`; OAuth stores `CODEX_AUTH_REF=secret:codex-oauth-local-cache` and mounts the host Codex auth cache into the worker container.

`npm run setup:vps` remains the guided setup artifact command used internally by the installer and for diagnostics after clone/bootstrap. It asks for the controller public URL, Nginx preference, API/web upstream ports, OpenClaw setup mode, Telegram bot token reference or value, Telegram chat ID, and Codex auth mode. The default OpenClaw mode is `detect-existing`, which runs `openclaw gateway status --json --require-rpc` and stores gateway details as references. In the one-command installer, `install-or-onboard` installs OpenClaw, initializes `gateway.mode=local` non-interactively, and starts the gateway; if OpenClaw's own service install/start does not produce a healthy gateway, the installer adds a system-level `/etc/systemd/system/openclaw-gateway.service` fallback before marking OpenClaw `configure-later`. Setup accepts the installer-provided explicit gateway URL when OpenClaw's status output is reachable but does not include a URL field. Use `advanced-webhook` only when you intentionally manage a webhook auth reference. Raw values are written only to an ignored env file such as `.env` or `/etc/auto-forge-controller/auto-forge.env`; setup JSON stores references only. OAuth device auth is supported by both the guided setup command and the one-command VPS installer.

`npm run live:smoke` requires staged or live `OPENCLAW_BASE_URL`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_TEST_CHAT_ID`. It also requires either `OPENAI_API_KEY` when `CODEX_AUTH_REF=env:OPENAI_API_KEY`, or a completed Codex OAuth device-auth cache when `CODEX_AUTH_REF=secret:codex-oauth-local-cache`. Default gateway mode does not require `OPENCLAW_TOKEN`; advanced webhook mode requires `OPENCLAW_AUTH_REF`. The live smoke treats OpenClaw CLI Telegram delivery as an optional diagnostic by default because controller Telegram replies use the Bot API directly; set `AUTO_FORGE_REQUIRE_OPENCLAW_TELEGRAM_DELIVERY=1` to make `openclaw message send --channel telegram` fail the gate. When `AUTO_FORGE_PUBLIC_BASE_URL` is set, live smoke also verifies public `/live` and web reachability so a dead domain cannot pass. Without required values it exits with `BLOCKED_EXTERNAL` and lists the missing requirements. The setup wizard can run the same live smoke path after it writes the env file and setup record.

## Service Ports

- API: `3000`
- Web onboarding UI: `5173`
- Postgres in Docker Compose: internal service `postgres:5432`

## Operational Files

- Setup record: `.auto-forge/setup.json`
- Installer runtime env: `/etc/auto-forge-controller/auto-forge.env`
- Installer Compose data directory: `/opt/auto-forge-controller/.auto-forge/compose-data/`
- Setup wizard Nginx preview: `.auto-forge/nginx/<domain>.conf`
- Worker heartbeat: `.auto-forge/worker-health.json`
- Task logs: `.auto-forge/logs/tasks/<task-id>/`
- Local npm service logs, when a service creates them: `.auto-forge/logs/services/<service>/`
- Backups: `backups/auto-forge-backup-*.json`
- Active brief state: `docs/exec-plans/active/2026-04-28-auto-forge-controller/automation/`

## Telegram Repo Registry

Telegram operators can inspect and switch registered repos without changing the controller checkout:

```bash
/repos
/repo
/repo use <alias>
/repo add-path <alias> <absolute-path>
/repo clone <alias> <git-url>
/repo pause <alias>
/repo resume <alias>
/scope @<alias> <task>
```

`/scope <task>` uses the operator's active repo. `/scope @<alias> <task>` targets a registered repo explicitly. Repo aliases must be short shell-safe names, and path registration resolves realpaths before accepting a repo. New paths and clone targets must stay under `AUTO_FORGE_ALLOWED_REPO_ROOTS`, which defaults to `/opt/auto-forge-repos`; symlink escapes and non-git directories are rejected. The controller refuses active repo switches while the current repo has a mutating worker or QA task running, and every add/use/pause/resume action is recorded as a repo registry event.

## GitHub SSH Deploy Keys

Repo-scoped deploy keys are managed through Telegram repo commands:

```text
/repo key create <alias>
/repo key show <alias>
/repo key test <alias>
/repo key github-add <alias> [--write]
/repo git-test <alias>
```

Keys are Ed25519 and default to `/etc/auto-forge-controller/ssh/<repo-derived-id>/id_ed25519`; override with `AUTO_FORGE_SSH_KEY_ROOT` for non-root or test installs. Private keys are written mode `0600` under restrictive directories and are never returned through Telegram or API responses. `/repo key show` returns only the public key, fingerprint, and manual GitHub setup instructions. API-based GitHub deploy-key creation requires `AUTO_FORGE_GITHUB_TOKEN` or `GITHUB_TOKEN`; it creates read-only deploy keys unless the operator explicitly passes `--write`. Git validation uses `git ls-remote`; push validation uses `git push --dry-run`.

## Health Model

`npm run ops:health` and `GET /health` report API reachability, web reachability, database config, onboarding setup, worker heartbeat, logs, repo-managed Codex CLI availability, and OpenClaw reachability. API reachability uses `AUTO_FORGE_API_HEALTH_URL` when set, otherwise `/live` under `AUTO_FORGE_PUBLIC_BASE_URL`. Web reachability uses `AUTO_FORGE_WEB_HEALTH_URL` or `AUTO_FORGE_WEB_BASE_URL` when set. The Codex check fails if an explicit `CODEX_CLI_COMMAND` override is not executable, or if the managed binary is missing after bootstrap/build. OpenClaw is skipped by default to avoid failing offline installs; use `-- --live-external` or `/health?liveExternal=true` when credentials and network are ready.

## Log Discovery

Task logs remain discoverable with:

```bash
npm run auto-forge -- logs --task <task-id>
```

Service logs are discoverable with:

```bash
npm run auto-forge -- logs --service api
npm run auto-forge -- logs --service worker
npm run auto-forge -- logs --service web
npm run auto-forge -- logs --service postgres
```

The service-log output reports the local npm log directory status, the matching Docker Compose command such as `docker compose logs api`, and systemd journal commands for the bundled API and worker units.
