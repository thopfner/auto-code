# VPS Install

## One-Command Install

Run this on a fresh Ubuntu VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/thopfner/auto-code/main/scripts/install-vps.sh | sudo bash
```

From an already cloned checkout, run:

```bash
sudo bash scripts/install-vps.sh
```

The installer is the normal VPS deployment path. It installs or verifies git, curl, Node.js 24, npm 11, Docker Engine, and the Docker Compose plugin; clones or updates `/opt/auto-forge-controller`; runs bootstrap with installer-specific output; writes `/etc/auto-forge-controller/auto-forge.env` with mode `0600`; writes references-only setup JSON into the Compose-mounted data directory; builds and starts Postgres, API, worker, and web; installs/reloads nginx when selected; optionally runs Certbot; runs Compose health/smoke checks; and then runs the live external smoke gate.

Dry-run proof is available without mutating the host:

```bash
AUTO_FORGE_INSTALL_DRY_RUN=1 \
AUTO_FORGE_PUBLIC_BASE_URL=https://forge.example.com \
TELEGRAM_BOT_TOKEN=<token> \
OPENAI_API_KEY=<key> \
bash scripts/install-vps.sh --dry-run
```

Dry-run output redacts raw secret values and prints only planned infrastructure actions.

## Guided Inputs

The installer asks only for product-level values:

- install directory, default `/opt/auto-forge-controller`
- runtime env file, default `/etc/auto-forge-controller/auto-forge.env`
- public domain or base URL
- whether to configure nginx
- whether to enable HTTPS through Certbot
- OpenClaw setup mode and gateway URL when needed
- Telegram bot token
- Telegram chat ID, with `getUpdates` discovery and manual fallback
- Codex auth mode, either ChatGPT OAuth device auth or OpenAI API key

`OPENCLAW_SETUP_MODE=detect-existing` is the default and remains fail-closed if the OpenClaw gateway cannot be discovered. Use `install-or-onboard` when the VPS should install OpenClaw, initialize `gateway.mode=local` non-interactively, and start the gateway daemon. The installer does not launch OpenClaw's own interactive onboarding wizard; if OpenClaw's own service install/start does not produce a healthy gateway, the installer adds a system-level `/etc/systemd/system/openclaw-gateway.service` fallback before marking OpenClaw `configure-later`. If OpenClaw status is reachable but omits a URL field, setup uses the explicit installer gateway URL. Use `configure-later` to save an explicitly incomplete setup that health/live smoke will report as externally blocked. Use `advanced-webhook` only when you intentionally provide an `env:` or `secret:` auth reference for an existing webhook integration.

The one-command installer supports Codex ChatGPT OAuth and API-key auth. OAuth runs the repo-managed `codex login --device-auth` flow, writes `CODEX_AUTH_REF=secret:codex-oauth-local-cache`, mounts the selected host Codex auth cache read-only at `/codex-auth-source`, and gives the containers a writable active `CODEX_HOME` at `/data/codex-home`. API-key auth writes `CODEX_AUTH_REF=env:OPENAI_API_KEY` and uses the same writable runtime home for Codex session, log, and cache state.

The installer does not provision the OpenClaw Telegram channel with the Auto Forge bot token. In the default path, Auto Forge owns inbound Telegram through `${AUTO_FORGE_PUBLIC_BASE_URL}/telegram/webhook`, and the managed OpenClaw gateway stays available for health and workspace support without competing for the same bot. Live smoke reports routed Telegram delivery through `openclaw message send --channel telegram` as an optional diagnostic by default; controller Telegram replies use the Bot API directly. Set `AUTO_FORGE_REQUIRE_OPENCLAW_TELEGRAM_DELIVERY=1` only for an explicitly separate OpenClaw Telegram channel that you expect to be configured outside the default installer path.

For HTTPS public URLs, the installer registers Telegram Bot API inbound delivery to `${AUTO_FORGE_PUBLIC_BASE_URL}/telegram/webhook` with a generated `TELEGRAM_WEBHOOK_SECRET` stored only in the runtime env file. Nginx routes `/telegram/webhook` to the controller API, while the web service allows the public host from `AUTO_FORGE_PUBLIC_BASE_URL` so browser access does not trip Vite host blocking.

Controller Telegram commands are authorized against the saved `TELEGRAM_TEST_CHAT_ID` by default. During discovery, the installer also persists `TELEGRAM_OPERATOR_CHAT_ID` and the discovered `TELEGRAM_OPERATOR_USER_ID` automatically, so private chats and group chats do not require manual env edits. If a chat ID is entered manually for a group, rerun discovery from a clean webhook state so the installer can capture the sender user ID.

On reruns, the installer reuses existing runtime defaults from `/etc/auto-forge-controller/auto-forge.env`, including Telegram token, chat ID, webhook secret, public URL, OpenClaw URL, and OpenAI API key when present. If a Telegram webhook is already active before chat discovery, `getUpdates` will not discover chats; enter the known chat ID manually or keep the saved `TELEGRAM_TEST_CHAT_ID`.

## Runtime Files

- Runtime env: `/etc/auto-forge-controller/auto-forge.env`, mode `0600`
- Compose project env pointers: `/opt/auto-forge-controller/.env`
- Codex OAuth source cache: `/root/.codex` by default, mounted read-only into API, worker, and smoke containers at `/codex-auth-source`
- Codex active runtime home: `/opt/auto-forge-controller/.auto-forge/compose-data/codex-home` on the host, mounted in containers as `/data/codex-home`
- Host setup JSON: `/opt/auto-forge-controller/.auto-forge/compose-data/setup.json`
- Container setup JSON path: `/data/setup.json`
- Logs/backups/worker heartbeat in the same Compose data directory under `/data`
- Runner prompts and artifacts: `/opt/auto-forge-controller/.auto-forge/compose-data/prompts` and `/opt/auto-forge-controller/.auto-forge/compose-data/artifacts`

The setup JSON stores references such as `env:TELEGRAM_BOT_TOKEN`, `env:OPENAI_API_KEY`, or `secret:codex-oauth-local-cache`; it must not contain raw Telegram/OpenAI/OpenClaw secret values. The runtime env file is the only installer-managed place for raw API-key secret values.

## Reruns And Recovery

The installer is safe to rerun. It updates an existing Git checkout with `git pull --ff-only`, rewrites only the managed setup block in the runtime env file, preserves the Compose data directory, and reuses existing Docker/nginx/Certbot installs. If nginx already has a non-Auto-Forge site at the managed site name, `scripts/configure-nginx.sh` fails closed so the operator can inspect the conflict.

If Certbot, DNS, Telegram, OpenClaw, or OpenAI validation is not ready, deterministic Compose deployment can still complete and the final live gate reports `BLOCKED_EXTERNAL`. Resolve the external dependency and rerun the installer.

## Diagnostic Commands

These commands remain available for QA and operator diagnostics:

```bash
npm run setup:vps
npm run ops:health
npm run ops:backup -- --dry-run
npm run ops:restore -- --input backups/example.json --dry-run
npm run full-rebuild
npm run live:smoke
npm run auto-forge -- logs --service api
npm run auto-forge -- logs --service worker
npm run auto-forge -- logs --service web
npm run auto-forge -- logs --service postgres
```

Manual Docker Compose diagnostics should load the project `.env` that the installer writes:

```bash
cd /opt/auto-forge-controller
docker compose ps
docker compose logs api
docker compose logs worker
docker compose logs web
docker compose logs postgres
```
