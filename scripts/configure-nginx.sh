#!/usr/bin/env bash
set -euo pipefail

CONFIG_PATH="${1:-}"
SITE_NAME="${2:-auto-forge-controller}"

if [[ -z "$CONFIG_PATH" ]]; then
  echo "usage: scripts/configure-nginx.sh <generated-config-path> [site-name]" >&2
  exit 2
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "Nginx is not installed. Install nginx first, then rerun this script." >&2
  exit 12
fi

if [[ ! -r "$CONFIG_PATH" ]]; then
  echo "Generated config is not readable: $CONFIG_PATH" >&2
  exit 2
fi

DEST="/etc/nginx/sites-available/${SITE_NAME}"
ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}"

if [[ -e "$DEST" ]] && ! grep -q "Auto Forge Controller Nginx site" "$DEST"; then
  echo "Existing conflicting Nginx site found at $DEST. Review it manually before rerunning." >&2
  exit 13
fi

sudo install -m 0644 "$CONFIG_PATH" "$DEST"
sudo ln -sfn "$DEST" "$ENABLED"
sudo nginx -t

if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl reload nginx
else
  sudo nginx -s reload
fi

echo "Auto Forge Nginx site installed at $DEST and enabled at $ENABLED"
