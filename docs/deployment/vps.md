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
```

Then set real secrets in the runtime environment:

```bash
sudo install -d -m 0750 -o auto-forge -g auto-forge /etc/auto-forge-controller
sudo install -m 0600 -o auto-forge -g auto-forge .env /etc/auto-forge-controller/auto-forge.env
```

Replace placeholder secret values before starting services.

## Docker Compose Path

```bash
docker compose build
docker compose up -d postgres api worker web
docker compose run --rm smoke
```

The Compose path mounts persistent controller state in the `auto_forge_data` volume and Postgres data in `auto_forge_postgres`.

## systemd Path

```bash
sudo cp systemd/auto-forge-api.service /etc/systemd/system/
sudo cp systemd/auto-forge-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now auto-forge-api auto-forge-worker
sudo systemctl status auto-forge-api auto-forge-worker
```

Run the web onboarding UI separately behind a reverse proxy or start it during setup:

```bash
npm run start:web -- --host 127.0.0.1 --port 5173
```

## Reverse Proxy

Terminate TLS at nginx, Caddy, or the host reverse proxy. Route:

- `/` to the web service during onboarding.
- `/health`, `/live`, `/setup`, `/telegram/command`, and `/approvals/*` to the API service.

Use HTTPS before configuring Telegram webhooks.
