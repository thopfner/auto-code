#!/usr/bin/env bash
set -euo pipefail

DRY_RUN="${AUTO_FORGE_INSTALL_DRY_RUN:-0}"
WORKSPACE_DIR="${OPENCLAW_WORKSPACE_DIR:-/root/.openclaw/workspace}"
OPENCLAW_COMMAND="${OPENCLAW_CLI_COMMAND:-openclaw}"

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --workspace-dir)
      shift
      WORKSPACE_DIR="${1:-}"
      [[ -n "$WORKSPACE_DIR" ]] || { echo "--workspace-dir requires a value" >&2; exit 2; }
      shift
      ;;
    --openclaw-command)
      shift
      OPENCLAW_COMMAND="${1:-}"
      [[ -n "$OPENCLAW_COMMAND" ]] || { echo "--openclaw-command requires a value" >&2; exit 2; }
      shift
      ;;
    --help|-h)
      cat <<'USAGE'
Managed OpenClaw bootstrap for Auto Forge Controller

Usage:
  bash scripts/setup-openclaw.sh [--workspace-dir <path>] [--openclaw-command <command>] [--dry-run]
USAGE
      exit 0
      ;;
    *)
      echo "Unsupported argument: $1" >&2
      exit 2
      ;;
  esac
done

log() {
  printf '[auto-forge-openclaw] %s\n' "$*" >&2
}

if [[ "$DRY_RUN" == "true" ]]; then
  DRY_RUN=1
fi

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY RUN: create managed OpenClaw workspace files in $WORKSPACE_DIR"
  log "DRY RUN: set OpenClaw gateway.mode, gateway.port, and agents.defaults.workspace with $OPENCLAW_COMMAND config set"
  log "DRY RUN: validate OpenClaw config with $OPENCLAW_COMMAND config validate"
  exit 0
fi

if ! command -v "$OPENCLAW_COMMAND" >/dev/null 2>&1; then
  log "ERROR: OpenClaw CLI '$OPENCLAW_COMMAND' is not installed or not on PATH"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_DIR"
npm exec -- tsx tools/setup-openclaw.ts --workspace-dir "$WORKSPACE_DIR" --openclaw-command "$OPENCLAW_COMMAND"
