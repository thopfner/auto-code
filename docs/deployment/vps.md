# VPS Install

## Prerequisites

- Ubuntu 24.04 or similar Linux host.
- Node.js 24 and npm 11, or Docker Engine with Docker Compose v2.
- Git and SSH access to target repos.
- Postgres 16 or newer for non-Compose systemd installs.
- A locked-down service account, recommended name `auto-forge`.

## One-Command Bootstrap After Clone

```bash
git clone <repo-url> /opt/auto-forge-controller
cd /opt/auto-forge-controller
scripts/bootstrap.sh
npm run setup:vps
```

The wizard is safe to rerun. It writes `.auto-forge/setup.json` with secret references only, writes raw token values only to the ignored env file you choose, generates `.auto-forge/nginx/<domain>.conf`, and can run live setup validation plus `npm run live:smoke`.

For a root-owned systemd env file, run the wizard with:

```bash
npm run setup:vps -- --env-file /etc/auto-forge-controller/auto-forge.env
```

The env file must remain mode `0600`. Raw `OPENCLAW_TOKEN`, `TELEGRAM_BOT_TOKEN`, and `OPENAI_API_KEY` values must not be copied into docs, reports, generated Nginx config, setup JSON, Git-tracked files, or backup bundles.

## Guided Setup Details

`npm run setup:vps` prompts for:

- controller public domain or base URL
- whether to configure Nginx automatically
- API and web upstream ports
- OpenClaw gateway base URL and token value or `env:`/`secret:` reference
- Telegram bot token value or `env:`/`secret:` reference
- Telegram chat ID, or `discover` to call Telegram `getUpdates`
- Codex auth mode

Telegram chat discovery uses the bot token to call `getUpdates`, lists discovered chat IDs, and asks which ID to use. If no chats are returned, send a message to the bot and rerun the wizard.

OpenClaw settings are handled explicitly. The wizard prints the controller command endpoint to paste into OpenClaw if the gateway does not expose a settings mutation API:

```text
https://<controller-domain>/telegram/command
```

It then validates OpenClaw health and routed Telegram delivery through the existing setup validation path.

Codex defaults to API-key auth with `CODEX_AUTH_REF=env:OPENAI_API_KEY`. The OAuth/manual-login path is available only after accepting trusted-machine constraints; it runs `codex login` and never copies auth caches into this repo or backup bundles. The final `npm run live:smoke` gate currently requires `OPENAI_API_KEY`.

## Docker Compose Path

```bash
docker compose build
docker compose up -d postgres api worker web
docker compose run --rm smoke
npm run full-rebuild
npm run live:smoke
npm run auto-forge -- logs --service api
npm run auto-forge -- logs --service worker
npm run auto-forge -- logs --service web
npm run auto-forge -- logs --service postgres
```

The Compose path mounts persistent controller state in the `auto_forge_data` volume and Postgres data in `auto_forge_postgres`.
The service-log discovery output includes the matching `docker compose logs <service>` command for each service.
Run `npm run live:smoke` only after exporting staged or live `OPENCLAW_BASE_URL`, `OPENCLAW_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_TEST_CHAT_ID`, and `OPENAI_API_KEY`.

## systemd Path

```bash
sudo cp systemd/auto-forge-api.service /etc/systemd/system/
sudo cp systemd/auto-forge-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now auto-forge-api auto-forge-worker
sudo systemctl status auto-forge-api auto-forge-worker
npm run auto-forge -- logs --service api
npm run auto-forge -- logs --service worker
```

The bundled systemd service-log discovery returns `journalctl -u auto-forge-api` and `journalctl -u auto-forge-worker`.

Run the web onboarding UI separately behind a reverse proxy or start it during setup:

```bash
npm run start:web -- --host 127.0.0.1 --port 5173
```

## Reverse Proxy

Terminate TLS at nginx, Caddy, or the host reverse proxy. Route:

- `/` to the web service during onboarding.
- `/health`, `/live`, `/setup`, `/telegram/command`, `/approvals/*`, `/workflow/*`, and `/tasks` to the API service.

The setup wizard writes a deterministic Nginx config preview and can install it with:

```bash
sudo bash scripts/configure-nginx.sh .auto-forge/nginx/<domain>.conf <domain>
```

Use HTTPS before configuring Telegram webhooks.
