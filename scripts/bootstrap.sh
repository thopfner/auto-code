#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required before bootstrap" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required before bootstrap" >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
  echo "Created .env from .env.example. Replace secret environment values before live onboarding."
fi

mkdir -p .auto-forge/logs backups
npm ci
npm run schema:check
npm run ops:install-check

cat <<'MSG'
Bootstrap complete.

Next:
  1. Edit .env and provide OPENAI_API_KEY and TELEGRAM_BOT_TOKEN in the shell or service environment.
     OpenClaw defaults to gateway discovery; use OPENCLAW_AUTH_REF only for advanced webhook installs.
  2. Start locally with npm run start:api, npm run start:worker, and npm run start:web.
  3. Open the web onboarding UI and validate Telegram/OpenClaw.
MSG
