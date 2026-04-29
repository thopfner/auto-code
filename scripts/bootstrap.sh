#!/usr/bin/env bash
set -euo pipefail

BOOTSTRAP_CONTEXT="${AUTO_FORGE_BOOTSTRAP_CONTEXT:-standalone}"

for arg in "$@"; do
  case "$arg" in
    --installer)
      BOOTSTRAP_CONTEXT="installer"
      ;;
    --help|-h)
      cat <<'USAGE'
Auto Forge Controller bootstrap

Usage:
  scripts/bootstrap.sh
  AUTO_FORGE_BOOTSTRAP_CONTEXT=installer scripts/bootstrap.sh --installer

Options:
  --installer  Keep checks but print installer-appropriate completion output
USAGE
      exit 0
      ;;
    *)
      echo "Unsupported argument: $arg" >&2
      exit 2
      ;;
  esac
done

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
  if [ "$BOOTSTRAP_CONTEXT" = "installer" ]; then
    echo "Created .env from .env.example for installer bootstrap. The VPS installer will replace it with Compose env pointers and write runtime secret references."
  else
    echo "Created .env from .env.example. Replace secret environment values before live onboarding."
  fi
fi

mkdir -p .auto-forge/logs backups
npm ci
if [ ! -x node_modules/.bin/codex ]; then
  echo "Managed Codex CLI was not installed at node_modules/.bin/codex. Re-run scripts/bootstrap.sh or rebuild the Docker image." >&2
  exit 1
fi
npm run schema:check
npm run ops:install-check

if [ "$BOOTSTRAP_CONTEXT" = "installer" ]; then
  cat <<'MSG'
Bootstrap checks complete for the VPS installer.

The installer will continue with runtime env creation, setup JSON, Docker Compose deployment, nginx/TLS when selected, and smoke checks.
MSG
else
  cat <<'MSG'
Bootstrap complete.

Next:
  1. Edit .env and provide OPENAI_API_KEY and TELEGRAM_BOT_TOKEN in the shell or service environment.
     Codex CLI is installed by this repo under node_modules/.bin/codex; set CODEX_CLI_COMMAND only for an intentional override.
     OpenClaw defaults to gateway discovery; use OPENCLAW_AUTH_REF only for advanced webhook installs.
  2. Start locally with npm run start:api, npm run start:worker, and npm run start:web.
  3. Open the web onboarding UI and validate Telegram/OpenClaw.
MSG
fi
