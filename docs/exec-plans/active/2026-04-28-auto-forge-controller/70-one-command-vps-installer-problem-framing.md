# One-Command VPS Installer Problem Framing

## Objective

Replace the current engineer-oriented launch checklist with a product-grade VPS installer that can take a fresh Ubuntu server from "nothing installed" to a running Auto Forge Controller with one guided command.

The operator should not manually install Docker, run bootstrap, chmod env files, build/start Compose services, copy nginx configs, run Certbot, or remember smoke-test commands.

## Desired Outcome

The public launch path becomes either:

```bash
curl -fsSL https://raw.githubusercontent.com/thopfner/auto-code/main/scripts/install-vps.sh | sudo bash
```

or, from an already cloned checkout:

```bash
sudo bash scripts/install-vps.sh
```

The installer should ask only for unavoidable product inputs:

- public domain/base URL
- Telegram bot token
- Telegram chat ID discovery/manual fallback
- OpenClaw mode/connection path
- OpenAI API key for unattended Codex automation
- whether to enable HTTPS automatically when DNS is ready

## Explicit Non-Goals

- Do not build the future browser/chat setup workflow in this revision.
- Do not replace Docker Compose with a different orchestrator.
- Do not require a customer to globally install Codex.
- Do not weaken OpenClaw fail-closed behavior.
- Do not store raw secrets in Git, setup JSON, generated nginx config, backup bundles, reports, or docs.
- Do not modify `/opt/forge-skills`.

## Current Codebase Findings

The repo has good building blocks but no full launch orchestrator:

- `scripts/bootstrap.sh` installs npm dependencies and the repo-managed Codex CLI, but assumes Node and npm already exist.
- `npm run setup:vps` can write env/setup/nginx artifacts, but the operator still has to choose flags and run deploy commands.
- `scripts/configure-nginx.sh` installs a generated nginx site, but it does not install nginx, issue TLS, or coordinate service startup.
- `docker-compose.yml` can run API, worker, web, Postgres, and smoke checks, but the current service environment hardcodes several values and defaults to `.env`.
- Compose services use `AUTO_FORGE_SETUP_PATH=/data/setup.json`, while the host setup wizard defaults to `.auto-forge/setup.json` unless explicitly told otherwise.
- `npm run full-rebuild` proves the stack locally, but it intentionally cleans Compose down and is not a customer deployment path.
- `npm run live:smoke` is the right external proof gate, but a customer should not need to discover and export its required variables manually.

## Primary User Problem

The product currently behaves like a source repo with deployment instructions. The target product must behave like SaaS infrastructure software with an installer.

The correct interface is one installer command, one guided flow, automatic prerequisite/deployment handling, and a final launch verdict.

## Constraints And Invariants

- The installer must be idempotent and resumable.
- Rerunning must preserve existing env/setup data unless the operator explicitly overwrites it.
- A root-owned runtime env file must be mode `0600`.
- Setup JSON must remain references-only.
- Docker Compose should run with the same runtime env file that setup writes.
- The installer must clearly distinguish:
  - local deterministic checks passed
  - deployment running
  - externally blocked because OpenClaw/Telegram/OpenAI credentials or DNS/TLS are not ready
- `npm run live:smoke` remains the go-live external gate.

## External Source Notes

- Docker's official Ubuntu install path uses Docker's apt repository and installs Docker Engine, CLI, containerd, buildx, and Compose plugin: https://docs.docker.com/engine/install/ubuntu/
- Docker Compose supports `env_file`, including optional env files with `required`, but environment precedence must be handled carefully so hardcoded Compose values do not override the installer-written runtime env: https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/
- Certbot's official nginx flow supports obtaining a certificate and updating nginx for HTTPS: https://certbot.eff.org/instructions?os=snap&ws=nginx

