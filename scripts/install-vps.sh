#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REPO_URL="https://github.com/thopfner/auto-code.git"
DEFAULT_INSTALL_DIR="/opt/auto-forge-controller"
DEFAULT_RUNTIME_ENV_FILE="/etc/auto-forge-controller/auto-forge.env"
DEFAULT_HOST_DATA_SUBDIR=".auto-forge/compose-data"
DEFAULT_CODEX_HOME_DIR="/root/.codex"
DEFAULT_API_PORT="3000"
DEFAULT_WEB_PORT="5173"

DRY_RUN="${AUTO_FORGE_INSTALL_DRY_RUN:-0}"
ASSUME_YES="${AUTO_FORGE_INSTALL_YES:-0}"
REPO_URL="${AUTO_FORGE_REPO_URL:-$DEFAULT_REPO_URL}"
INSTALL_DIR="${AUTO_FORGE_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
RUNTIME_ENV_FILE="${AUTO_FORGE_RUNTIME_ENV_FILE:-$DEFAULT_RUNTIME_ENV_FILE}"
PUBLIC_BASE_URL="${AUTO_FORGE_PUBLIC_BASE_URL:-}"
CONFIGURE_NGINX="${AUTO_FORGE_CONFIGURE_NGINX:-}"
ENABLE_TLS="${AUTO_FORGE_ENABLE_TLS:-}"
CERTBOT_EMAIL="${AUTO_FORGE_CERTBOT_EMAIL:-}"
OPENCLAW_SETUP_MODE="${OPENCLAW_SETUP_MODE:-detect-existing}"
OPENCLAW_BASE_URL="${OPENCLAW_BASE_URL:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_TEST_CHAT_ID:-}"
TELEGRAM_OPERATOR_CHAT_ID="${TELEGRAM_OPERATOR_CHAT_ID:-}"
TELEGRAM_OPERATOR_USER_ID="${TELEGRAM_OPERATOR_USER_ID:-}"
CODEX_AUTH_MODE="${AUTO_FORGE_CODEX_AUTH_MODE:-}"
CODEX_AUTH_REF=""
CODEX_HOME_DIR="${AUTO_FORGE_CODEX_HOME_DIR:-$DEFAULT_CODEX_HOME_DIR}"
API_PORT="${AUTO_FORGE_API_PORT:-$DEFAULT_API_PORT}"
WEB_PORT="${AUTO_FORGE_WEB_PORT:-$DEFAULT_WEB_PORT}"
HOST_DATA_DIR="${AUTO_FORGE_HOST_DATA_DIR:-}"
REUSE_EXISTING_RUNTIME_ENV_DEFAULTS=0

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=1
      ;;
    --yes|-y)
      ASSUME_YES=1
      ;;
    --help|-h)
      cat <<'USAGE'
Auto Forge Controller VPS installer

Usage:
  curl -fsSL https://raw.githubusercontent.com/thopfner/auto-code/main/scripts/install-vps.sh | sudo bash
  sudo bash scripts/install-vps.sh

Options:
  --dry-run   Print the deployment plan without mutating the host
  --yes       Accept default yes/no answers where possible

Environment overrides:
  AUTO_FORGE_INSTALL_DIR, AUTO_FORGE_RUNTIME_ENV_FILE, AUTO_FORGE_PUBLIC_BASE_URL,
  AUTO_FORGE_CONFIGURE_NGINX, AUTO_FORGE_ENABLE_TLS, AUTO_FORGE_CERTBOT_EMAIL,
  OPENCLAW_SETUP_MODE, OPENCLAW_BASE_URL, TELEGRAM_BOT_TOKEN,
  TELEGRAM_TEST_CHAT_ID, TELEGRAM_OPERATOR_CHAT_ID, TELEGRAM_OPERATOR_USER_ID,
  AUTO_FORGE_CODEX_AUTH_MODE, OPENAI_API_KEY, AUTO_FORGE_CODEX_HOME_DIR
USAGE
      exit 0
      ;;
    *)
      echo "Unsupported argument: $arg" >&2
      exit 2
      ;;
  esac
done

if [[ "$DRY_RUN" == "true" ]]; then
  DRY_RUN=1
fi

log() {
  printf '[auto-forge-install] %s\n' "$*" >&2
}

die() {
  printf '[auto-forge-install] ERROR: %s\n' "$*" >&2
  exit 1
}

is_dry_run() {
  [[ "$DRY_RUN" == "1" ]]
}

run() {
  local description="$1"
  shift
  if is_dry_run; then
    log "DRY RUN: $description"
    return 0
  fi
  log "$description"
  "$@"
}

run_shell() {
  local description="$1"
  local command="$2"
  if is_dry_run; then
    log "DRY RUN: $description"
    return 0
  fi
  log "$description"
  bash -c "$command"
}

prompt_value() {
  local label="$1"
  local default_value="$2"
  local answer=""
  if is_dry_run || [[ -n "$default_value" && "$ASSUME_YES" == "1" ]] || [[ -n "$default_value" && "$REUSE_EXISTING_RUNTIME_ENV_DEFAULTS" == "1" ]]; then
    printf '%s\n' "$default_value"
    return 0
  fi
  if [[ ! -r /dev/tty ]]; then
    [[ -n "$default_value" ]] || die "$label is required; set the matching environment variable for non-interactive installs"
    printf '%s\n' "$default_value"
    return 0
  fi
  read -r -p "$label [$default_value]: " answer </dev/tty
  printf '%s\n' "${answer:-$default_value}"
}

prompt_required() {
  local label="$1"
  local default_value="$2"
  local answer
  answer="$(prompt_value "$label" "$default_value")"
  [[ -n "$answer" ]] || die "$label is required"
  printf '%s\n' "$answer"
}

prompt_secret() {
  local label="$1"
  local default_value="$2"
  local answer=""
  if is_dry_run || [[ -n "$default_value" && "$ASSUME_YES" == "1" ]] || [[ -n "$default_value" && "$REUSE_EXISTING_RUNTIME_ENV_DEFAULTS" == "1" ]]; then
    printf '%s\n' "$default_value"
    return 0
  fi
  if [[ ! -r /dev/tty ]]; then
    [[ -n "$default_value" ]] || die "$label is required; provide it through the environment for non-interactive installs"
    printf '%s\n' "$default_value"
    return 0
  fi
  read -r -s -p "$label [hidden, leave blank to keep existing env value]: " answer </dev/tty
  printf '\n' >/dev/tty
  printf '%s\n' "${answer:-$default_value}"
}

prompt_bool() {
  local label="$1"
  local default_value="$2"
  local normalized
  normalized="$(printf '%s' "$default_value" | tr '[:upper:]' '[:lower:]')"
  case "$normalized" in
    1|true|yes|y) default_value="yes" ;;
    0|false|no|n) default_value="no" ;;
    "") default_value="no" ;;
  esac
  if is_dry_run || [[ "$ASSUME_YES" == "1" ]] || [[ "$REUSE_EXISTING_RUNTIME_ENV_DEFAULTS" == "1" ]]; then
    printf '%s\n' "$default_value"
    return 0
  fi
  local suffix="y/N"
  [[ "$default_value" == "yes" ]] && suffix="Y/n"
  local answer=""
  if [[ ! -r /dev/tty ]]; then
    printf '%s\n' "$default_value"
    return 0
  fi
  read -r -p "$label [$suffix]: " answer </dev/tty
  answer="$(printf '%s' "${answer:-$default_value}" | tr '[:upper:]' '[:lower:]')"
  case "$answer" in
    yes|y|1|true) printf 'yes\n' ;;
    *) printf 'no\n' ;;
  esac
}

read_runtime_env_value() {
  local key="$1"
  [[ -r "$RUNTIME_ENV_FILE" ]] || return 1
  bash -c '
set -euo pipefail
set -a
. "$1"
set +a
key="$2"
printf "%s" "${!key-}"
' bash "$RUNTIME_ENV_FILE" "$key"
}

apply_existing_runtime_env_defaults() {
  if is_dry_run || [[ ! -r "$RUNTIME_ENV_FILE" ]]; then
    return 0
  fi

  local value
  local reused=0
  if [[ -z "${PUBLIC_BASE_URL:-}" ]]; then
    value="$(read_runtime_env_value AUTO_FORGE_PUBLIC_BASE_URL || true)"
    if [[ -n "$value" ]]; then
      PUBLIC_BASE_URL="$value"
      reused=1
    fi
  fi
  if [[ -z "${OPENCLAW_BASE_URL:-}" ]]; then
    value="$(read_runtime_env_value OPENCLAW_BASE_URL || true)"
    if [[ -n "$value" ]]; then
      OPENCLAW_BASE_URL="$value"
      reused=1
    fi
  fi
  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
    value="$(read_runtime_env_value TELEGRAM_BOT_TOKEN || true)"
    if [[ -n "$value" ]]; then
      TELEGRAM_BOT_TOKEN="$value"
      reused=1
    fi
  fi
  if [[ -z "${TELEGRAM_CHAT_ID:-}" ]]; then
    value="$(read_runtime_env_value TELEGRAM_TEST_CHAT_ID || true)"
    if [[ -n "$value" ]]; then
      TELEGRAM_CHAT_ID="$value"
      log "Using existing Telegram chat ID from $RUNTIME_ENV_FILE"
      reused=1
    fi
  fi
  if [[ -z "${TELEGRAM_OPERATOR_CHAT_ID:-}" ]]; then
    value="$(read_runtime_env_value TELEGRAM_OPERATOR_CHAT_ID || true)"
    if [[ -n "$value" ]]; then
      TELEGRAM_OPERATOR_CHAT_ID="$value"
      reused=1
    fi
  fi
  if [[ -z "${TELEGRAM_OPERATOR_USER_ID:-}" ]]; then
    value="$(read_runtime_env_value TELEGRAM_OPERATOR_USER_ID || true)"
    if [[ -n "$value" ]]; then
      TELEGRAM_OPERATOR_USER_ID="$value"
      reused=1
    fi
  fi
  if [[ -z "${TELEGRAM_WEBHOOK_SECRET:-}" ]]; then
    value="$(read_runtime_env_value TELEGRAM_WEBHOOK_SECRET || true)"
    if [[ -n "$value" ]]; then
      TELEGRAM_WEBHOOK_SECRET="$value"
      reused=1
    fi
  fi
  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    value="$(read_runtime_env_value OPENAI_API_KEY || true)"
    if [[ -n "$value" ]]; then
      OPENAI_API_KEY="$value"
      reused=1
    fi
  fi

  if [[ "$reused" == "1" ]]; then
    REUSE_EXISTING_RUNTIME_ENV_DEFAULTS=1
    log "Reusing existing runtime env defaults from $RUNTIME_ENV_FILE. Set environment variables before running the installer to override them."
  fi
}

normalize_base_url() {
  local value="$1"
  if [[ "$value" != http://* && "$value" != https://* ]]; then
    value="https://$value"
  fi
  printf '%s\n' "${value%/}"
}

domain_from_url() {
  node -e "console.log(new URL(process.argv[1]).hostname)" "$1"
}

safe_site_name() {
  printf '%s\n' "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9.-]/-/g'
}

check_root() {
  if is_dry_run; then
    return 0
  fi
  [[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run this installer with sudo so it can install prerequisites, write $RUNTIME_ENV_FILE, and configure Docker/nginx"
}

check_supported_os() {
  if is_dry_run; then
    log "DRY RUN: verify supported Ubuntu OS"
    return 0
  fi
  [[ -r /etc/os-release ]] || die "Cannot identify OS. This installer currently supports Ubuntu."
  # shellcheck disable=SC1091
  . /etc/os-release
  [[ "${ID:-}" == "ubuntu" ]] || die "Unsupported OS '${ID:-unknown}'. Use Ubuntu 22.04/24.04 or install manually from docs/deployment/vps.md."
}

install_base_prerequisites() {
  run "Install base prerequisites with apt" apt-get update
  run "Install git, curl, ca-certificates, gnupg, lsb-release, and sudo" apt-get install -y git curl ca-certificates gnupg lsb-release sudo
}

node_major_version() {
  if ! command -v node >/dev/null 2>&1; then
    printf '0\n'
    return 0
  fi
  node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || printf '0\n'
}

ensure_node() {
  if [[ "$(node_major_version)" -ge 24 ]] && command -v npm >/dev/null 2>&1; then
    log "Node.js 24+ and npm are already installed"
    return 0
  fi
  run_shell "Install Node.js 24 from the NodeSource apt repository" "curl -fsSL https://deb.nodesource.com/setup_24.x | bash -"
  run "Install nodejs package" apt-get install -y nodejs
  run "Install npm 11.6.2" npm install -g npm@11.6.2
}

docker_compose_ready() {
  command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1
}

ensure_docker() {
  if is_dry_run; then
    log "DRY RUN: Install Docker official apt repository key if Docker/Compose are missing"
    log "DRY RUN: Install Docker Engine and Compose plugin if missing"
    return 0
  fi
  if docker_compose_ready; then
    log "Docker Engine and Compose plugin are already installed"
    return 0
  fi
  run "Create Docker apt keyring directory" install -m 0755 -d /etc/apt/keyrings
  run_shell "Install Docker official apt repository key" "curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc && chmod a+r /etc/apt/keyrings/docker.asc"
  run_shell "Install Docker official apt repository list" 'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list'
  run "Refresh apt metadata after adding Docker repository" apt-get update
  run "Install Docker Engine and Compose plugin" apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  if command -v systemctl >/dev/null 2>&1; then
    run "Enable and start Docker" systemctl enable --now docker
  fi
}

detect_local_repo() {
  local script_path="${BASH_SOURCE[0]:-}"
  local candidate=""
  if [[ -n "$script_path" && -f "$script_path" ]]; then
    candidate="$(cd "$(dirname "$script_path")/.." && pwd)"
    if [[ -f "$candidate/package.json" && -f "$candidate/docker-compose.yml" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  fi
  if [[ -f "package.json" && -f "docker-compose.yml" && -f "scripts/install-vps.sh" ]]; then
    pwd
    return 0
  fi
  return 1
}

prepare_repo() {
  local local_repo=""
  if local_repo="$(detect_local_repo)"; then
    log "Using local checkout at $local_repo"
    printf '%s\n' "$local_repo"
    return 0
  fi

  if is_dry_run; then
    log "DRY RUN: clone or update $REPO_URL into $INSTALL_DIR"
    printf '%s\n' "$INSTALL_DIR"
    return 0
  fi

  if [[ -d "$INSTALL_DIR/.git" ]]; then
    run "Update existing checkout at $INSTALL_DIR" git -C "$INSTALL_DIR" pull --ff-only
  elif [[ -e "$INSTALL_DIR" ]]; then
    die "$INSTALL_DIR exists but is not a Git checkout. Move it aside or set AUTO_FORGE_INSTALL_DIR."
  else
    run "Clone Auto Forge Controller into $INSTALL_DIR" git clone "$REPO_URL" "$INSTALL_DIR"
  fi
  printf '%s\n' "$INSTALL_DIR"
}

telegram_webhook_url() {
  local token="$1"
  local payload
  payload="$(curl -fsS -X POST "https://api.telegram.org/bot${token}/getWebhookInfo")" || return 1
  printf '%s' "$payload" | node -e '
const fs = require("node:fs");
const payload = JSON.parse(fs.readFileSync(0, "utf8"));
const url = payload?.result?.url;
if (payload?.ok && typeof url === "string" && url.length > 0) {
  console.log(url);
}
'
}

clear_telegram_webhook_for_discovery() {
  local token="$1"
  if is_dry_run; then
    log "DRY RUN: clear existing Telegram webhook before getUpdates discovery"
    return 0
  fi
  curl -fsS -X POST "https://api.telegram.org/bot${token}/deleteWebhook" \
    -H "content-type: application/json" \
    -d '{"drop_pending_updates":true}' >/dev/null
}

pause_existing_openclaw_gateway_for_installer_onboarding() {
  if [[ "$OPENCLAW_SETUP_MODE" != "install-or-onboard" ]]; then
    return 0
  fi
  if is_dry_run; then
    log "DRY RUN: pause any existing OpenClaw gateway before Telegram discovery"
    return 0
  fi
  if command -v systemctl >/dev/null 2>&1; then
    systemctl stop openclaw-gateway.service >/dev/null 2>&1 || true
  fi
  if command -v openclaw >/dev/null 2>&1; then
    openclaw gateway stop >/dev/null 2>&1 || true
  fi
}

discover_telegram_chat_id() {
  local token="$1"
  local current="$2"
  if [[ -n "$current" && "$current" != "discover" ]]; then
    [[ -n "${TELEGRAM_OPERATOR_CHAT_ID:-}" ]] || TELEGRAM_OPERATOR_CHAT_ID="$current"
    if [[ -z "${TELEGRAM_OPERATOR_USER_ID:-}" && "$current" != -* ]]; then
      TELEGRAM_OPERATOR_USER_ID="$current"
    fi
    printf '%s\n' "$current"
    return 0
  fi
  if is_dry_run; then
    printf '%s\n' "${current:-discover}"
    return 0
  fi
  while true; do
    local webhook_url
    webhook_url="$(telegram_webhook_url "$token" || true)"
    if [[ -n "$webhook_url" ]]; then
      log "Telegram already has an active webhook at $webhook_url. Clearing it temporarily so getUpdates can discover the operator chat."
      clear_telegram_webhook_for_discovery "$token"
      log "Webhook cleared for discovery. Send a fresh message to the bot now; the installer will wait for it."
    fi

    log "Discovering Telegram chats with getUpdates. The bot token will not be printed. Waiting up to 30 seconds for a fresh bot message."
    local payload
    if ! payload="$(curl -fsS --max-time 35 -X POST "https://api.telegram.org/bot${token}/getUpdates" \
      -H "content-type: application/json" \
      -d '{"timeout":30,"allowed_updates":["message","channel_post","my_chat_member"]}')"; then
      log "Telegram discovery failed. Enter the chat ID manually or retry."
    else
      local chats
      chats="$(printf '%s' "$payload" | node -e '
const fs = require("node:fs");
const payload = JSON.parse(fs.readFileSync(0, "utf8"));
const seen = new Set();
for (const update of payload.result || []) {
  const chat = update.message?.chat || update.channel_post?.chat || update.my_chat_member?.chat;
  if (!chat || chat.id === undefined || seen.has(String(chat.id))) continue;
  seen.add(String(chat.id));
  const userId = update.message?.from?.id || update.my_chat_member?.from?.id || "";
  const label = chat.title || chat.username || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.type || "chat";
  console.log(`${chat.id}\t${userId}\t${label}`);
}
')" || chats=""
      if [[ -n "$chats" ]]; then
        printf '%s\n' "$chats" | awk -F '\t' '{ if ($2) printf "%s\t%s\tuser:%s\n", $1, $3, $2; else printf "%s\t%s\n", $1, $3 }' >/dev/tty
        local selected
        selected="$(prompt_required "Telegram chat ID to use" "$(printf '%s\n' "$chats" | head -n 1 | cut -f1)")"
        TELEGRAM_OPERATOR_CHAT_ID="$selected"
        local selected_user
        selected_user="$(printf '%s\n' "$chats" | awk -F '\t' -v selected="$selected" '$1 == selected { print $2; exit }')"
        if [[ -n "$selected_user" ]]; then
          TELEGRAM_OPERATOR_USER_ID="$selected_user"
        elif [[ "$selected" != -* ]]; then
          TELEGRAM_OPERATOR_USER_ID="$selected"
        fi
        printf '%s\n' "$selected"
        return 0
      fi
      log "Telegram returned no chats. Send a message to the bot, then retry or enter the chat ID manually."
    fi

    local action
    action="$(prompt_value 'Type "retry" or "manual"' "retry")"
    if [[ "$action" != "retry" ]]; then
      local selected
      selected="$(prompt_required "Telegram chat ID" "")"
      [[ -n "${TELEGRAM_OPERATOR_CHAT_ID:-}" ]] || TELEGRAM_OPERATOR_CHAT_ID="$selected"
      if [[ -z "${TELEGRAM_OPERATOR_USER_ID:-}" && "$selected" != -* ]]; then
        TELEGRAM_OPERATOR_USER_ID="$selected"
      fi
      printf '%s\n' "$selected"
      return 0
    fi
  done
}

write_compose_project_env() {
  local repo_dir="$1"
  local project_env="$repo_dir/.env"
  if is_dry_run; then
    log "DRY RUN: write Compose project env pointers to $project_env"
    return 0
  fi
  cat >"$project_env" <<EOF
AUTO_FORGE_RUNTIME_ENV_FILE=$RUNTIME_ENV_FILE
AUTO_FORGE_HOST_DATA_DIR=$HOST_DATA_DIR
AUTO_FORGE_COMPOSE_SETUP_PATH=/data/setup.json
AUTO_FORGE_API_PORT=$API_PORT
AUTO_FORGE_WEB_PORT=$WEB_PORT
AUTO_FORGE_CODEX_HOME_DIR=$CODEX_HOME_DIR
AUTO_FORGE_WEB_ALLOWED_HOSTS=$(domain_from_url "$PUBLIC_BASE_URL")
EOF
  chmod 0644 "$project_env"
}

install_openclaw_system_service_fallback() {
  local openclaw_path
  openclaw_path="$(command -v openclaw || true)"
  if [[ -z "$openclaw_path" ]]; then
    log "OpenClaw CLI path is unavailable; cannot install system service fallback"
    return 1
  fi
  if ! command -v systemctl >/dev/null 2>&1; then
    log "systemctl is unavailable; cannot install OpenClaw system service fallback"
    return 1
  fi

  log "Installing OpenClaw gateway as a systemd system service fallback"
  cat >/etc/systemd/system/openclaw-gateway.service <<EOF
[Unit]
Description=OpenClaw Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=HOME=/root
EnvironmentFile=-/root/.openclaw/.env
WorkingDirectory=/root
ExecStart=$openclaw_path gateway --port 18789
Restart=always
RestartSec=5
TimeoutStopSec=30
TimeoutStartSec=30
SuccessExitStatus=0 143
KillMode=control-group

[Install]
WantedBy=multi-user.target
EOF
  chmod 0644 /etc/systemd/system/openclaw-gateway.service
  if ! systemctl daemon-reload; then
    log "systemd daemon reload failed for OpenClaw fallback service"
    return 1
  fi
  if ! systemctl enable --now openclaw-gateway.service; then
    log "OpenClaw fallback system service did not start"
    return 1
  fi
  sleep 2
}

ensure_openclaw_local_gateway_config() {
  local config_dir="/root/.openclaw"
  local config_path="$config_dir/openclaw.json"
  mkdir -p "$config_dir/workspace"

  log "Ensuring OpenClaw local gateway config without launching interactive onboarding"
  if openclaw config set gateway.mode local &&
    openclaw config set gateway.port 18789 &&
    openclaw config set agents.defaults.workspace /root/.openclaw/workspace; then
    return 0
  fi

  if [[ -f "$config_path" ]]; then
    log "OpenClaw config exists but could not be updated automatically at $config_path"
    return 1
  fi

  cat >"$config_path" <<'EOF'
{
  "gateway": {
    "mode": "local",
    "port": 18789
  },
  "agents": {
    "defaults": {
      "workspace": "/root/.openclaw/workspace"
    }
  }
}
EOF
  chmod 0600 "$config_path"
}

ensure_openclaw_telegram_config() {
  local config_dir="/root/.openclaw"
  local env_path="$config_dir/.env"
  local token_path="$config_dir/telegram-bot-token"
  local config_path="$config_dir/openclaw.json"
  mkdir -p "$config_dir"

  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
    log "Telegram bot token is unavailable; skipping OpenClaw Telegram channel config"
    return 0
  fi

  log "Ensuring OpenClaw Telegram channel config without storing the token in setup JSON"
  cat >"$env_path" <<EOF
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
EOF
  chmod 0600 "$env_path"
  printf '%s\n' "$TELEGRAM_BOT_TOKEN" >"$token_path"
  chmod 0600 "$token_path"

  node - "$config_path" "$token_path" "${TELEGRAM_CHAT_ID:-}" <<'NODE'
const { readFileSync, writeFileSync } = require("node:fs");
const [configPath, tokenPath, telegramChatId] = process.argv.slice(2);
let config = {};
try {
  config = JSON.parse(readFileSync(configPath, "utf8"));
} catch {
  config = {};
}

config.gateway = { ...(config.gateway ?? {}), mode: config.gateway?.mode ?? "local", port: config.gateway?.port ?? 18789 };
config.agents = {
  ...(config.agents ?? {}),
  defaults: {
    ...(config.agents?.defaults ?? {}),
    workspace: config.agents?.defaults?.workspace ?? "/root/.openclaw/workspace"
  }
};

config.channels = config.channels ?? {};
const telegram = {
  ...(config.channels.telegram ?? {}),
  enabled: true,
  tokenFile: tokenPath,
  actions: { ...(config.channels.telegram?.actions ?? {}), sendMessage: true }
};

if (telegramChatId) {
  telegram.defaultTo = telegramChatId;
  if (telegramChatId.startsWith("-")) {
    telegram.groups = telegram.groups ?? {};
    telegram.groups[telegramChatId] = { ...(telegram.groups[telegramChatId] ?? {}), enabled: true };
  } else {
    telegram.dmPolicy = telegram.dmPolicy ?? "allowlist";
    const allowFrom = new Set(Array.isArray(telegram.allowFrom) ? telegram.allowFrom.map(String) : []);
    allowFrom.add(telegramChatId);
    telegram.allowFrom = [...allowFrom];
  }
}

config.channels.telegram = telegram;
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
NODE
  chmod 0600 "$config_path"

  if ! openclaw config set channels.telegram.enabled true; then
    log "OpenClaw Telegram channel enable did not complete automatically"
  fi
  if ! openclaw config set channels.telegram.tokenFile "$token_path"; then
    log "OpenClaw Telegram token file config did not complete automatically"
  fi
  if [[ -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    if ! openclaw config set channels.telegram.defaultTo "$TELEGRAM_CHAT_ID"; then
      log "OpenClaw Telegram default target config did not complete automatically"
    fi
  fi
}

ensure_openclaw_gateway() {
  if [[ "$OPENCLAW_SETUP_MODE" != "install-or-onboard" ]]; then
    return 0
  fi
  if is_dry_run; then
    log "DRY RUN: install OpenClaw CLI if missing"
    log "DRY RUN: write gateway.mode=local OpenClaw config non-interactively"
    log "DRY RUN: write OpenClaw Telegram channel config using /root/.openclaw/.env"
    log "DRY RUN: install/start OpenClaw gateway non-interactively"
    log "DRY RUN: install/start /etc/systemd/system/openclaw-gateway.service if OpenClaw's own service install does not produce a healthy gateway"
    log "DRY RUN: verify OpenClaw gateway with openclaw gateway status --json --require-rpc, or continue with Auto Forge onboarding if not ready"
    return 0
  fi
  if ! command -v openclaw >/dev/null 2>&1; then
    run_shell "Install OpenClaw CLI" "curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash -s -- --no-onboard"
  fi
  if ! ensure_openclaw_local_gateway_config; then
    log "OpenClaw local gateway config could not be initialized automatically"
  fi
  ensure_openclaw_telegram_config
  if openclaw gateway restart --json >/dev/null 2>&1; then
    log "OpenClaw gateway restarted after config refresh"
  fi
  if openclaw gateway status --json --require-rpc >/dev/null 2>&1; then
    log "OpenClaw gateway is already running"
    return 0
  fi
  log "Installing and starting OpenClaw gateway without launching OpenClaw's interactive onboarding"
  if ! openclaw gateway install --port 18789 --runtime node --force --json; then
    log "OpenClaw gateway install did not complete automatically"
  fi
  if ! openclaw gateway start; then
    log "OpenClaw gateway start did not complete automatically"
  fi
  if openclaw gateway status --json --require-rpc >/dev/null 2>&1; then
    log "OpenClaw gateway is running"
    return 0
  fi
  if ! openclaw gateway restart --json; then
    log "OpenClaw gateway restart after Telegram config did not complete automatically"
  fi
  if openclaw gateway status --json --require-rpc >/dev/null 2>&1; then
    log "OpenClaw gateway is running after Telegram config restart"
    return 0
  fi
  if install_openclaw_system_service_fallback && openclaw gateway status --json --require-rpc >/dev/null 2>&1; then
    log "OpenClaw gateway is running via systemd system service fallback"
    return 0
  fi
  log "OpenClaw gateway still needs onboarding. Continuing Auto Forge deployment with OpenClaw marked configure-later."
  OPENCLAW_SETUP_MODE="configure-later"
  OPENCLAW_BASE_URL="${OPENCLAW_BASE_URL:-http://localhost:18789}"
}

configure_codex_auth() {
  local repo_dir="$1"
  case "$CODEX_AUTH_MODE" in
    api-key)
      CODEX_AUTH_REF="env:OPENAI_API_KEY"
      OPENAI_API_KEY="$(prompt_secret "OpenAI API key for Codex" "${OPENAI_API_KEY:-}")"
      ;;
    oauth)
      CODEX_AUTH_REF="secret:codex-oauth-local-cache"
      if is_dry_run; then
        log "DRY RUN: run Codex OAuth device auth with repo-managed Codex CLI"
        return 0
      fi
      mkdir -p "$CODEX_HOME_DIR"
      chmod 0700 "$CODEX_HOME_DIR"
      run "Authenticate Codex with ChatGPT OAuth device auth" env -u OPENAI_API_KEY CODEX_HOME="$CODEX_HOME_DIR" "$repo_dir/node_modules/.bin/codex" login --device-auth
      run "Verify Codex OAuth login" env -u OPENAI_API_KEY CODEX_HOME="$CODEX_HOME_DIR" "$repo_dir/node_modules/.bin/codex" login status
      ;;
    *)
      die "Unsupported Codex auth mode '$CODEX_AUTH_MODE'. Use oauth or api-key."
      ;;
  esac
}

run_setup_wizard() {
  local repo_dir="$1"
  local setup_args=(
    run setup:vps --
    --non-interactive
    --runtime-env-file "$RUNTIME_ENV_FILE"
    --setup-path "$HOST_DATA_DIR/setup.json"
    --runtime-setup-path /data/setup.json
    --public-base-url "$PUBLIC_BASE_URL"
    --api-port "$API_PORT"
    --web-port "$WEB_PORT"
    --openclaw-mode "$OPENCLAW_SETUP_MODE"
    --telegram-bot-token-ref env:TELEGRAM_BOT_TOKEN
    --telegram-chat-id "$TELEGRAM_CHAT_ID"
    --telegram-operator-chat-id "${TELEGRAM_OPERATOR_CHAT_ID:-$TELEGRAM_CHAT_ID}"
    --codex-auth-ref "$CODEX_AUTH_REF"
  )
  if [[ -n "${TELEGRAM_OPERATOR_USER_ID:-}" ]]; then
    setup_args+=(--telegram-operator-user-id "$TELEGRAM_OPERATOR_USER_ID")
  fi
  if [[ -n "$OPENCLAW_BASE_URL" ]]; then
    setup_args+=(--openclaw-base-url "$OPENCLAW_BASE_URL")
  fi

  if is_dry_run; then
    log "DRY RUN: run setup wizard with runtime env $RUNTIME_ENV_FILE, host setup $HOST_DATA_DIR/setup.json, container setup /data/setup.json, and env secret references"
    return 0
  fi

  mkdir -p "$(dirname "$RUNTIME_ENV_FILE")" "$HOST_DATA_DIR"
  chmod 0700 "$(dirname "$RUNTIME_ENV_FILE")"
  (
    cd "$repo_dir"
    TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}" \
    TELEGRAM_WEBHOOK_SECRET="${TELEGRAM_WEBHOOK_SECRET:-}" \
    TELEGRAM_OPERATOR_CHAT_ID="${TELEGRAM_OPERATOR_CHAT_ID:-$TELEGRAM_CHAT_ID}" \
    TELEGRAM_OPERATOR_USER_ID="${TELEGRAM_OPERATOR_USER_ID:-}" \
    OPENAI_API_KEY="${OPENAI_API_KEY:-}" \
    CODEX_HOME="$CODEX_HOME_DIR" \
    npm "${setup_args[@]}"
  )
  chmod 0600 "$RUNTIME_ENV_FILE"
}

ensure_telegram_webhook_secret_value() {
  if [[ -n "${TELEGRAM_WEBHOOK_SECRET:-}" ]]; then
    return 0
  fi
  if ! is_dry_run && [[ -r "$RUNTIME_ENV_FILE" ]]; then
    local existing
    existing="$(awk -F= '$1 == "TELEGRAM_WEBHOOK_SECRET" { print $2; exit }' "$RUNTIME_ENV_FILE")"
    if [[ -n "$existing" ]]; then
      TELEGRAM_WEBHOOK_SECRET="$existing"
      return 0
    fi
  fi
  if is_dry_run; then
    TELEGRAM_WEBHOOK_SECRET="dry-run-telegram-webhook-secret"
    return 0
  fi
  TELEGRAM_WEBHOOK_SECRET="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")"
}

ensure_nginx() {
  if [[ "$CONFIGURE_NGINX" != "yes" ]]; then
    return 0
  fi
  if command -v nginx >/dev/null 2>&1; then
    log "nginx is already installed"
    return 0
  fi
  run "Install nginx" apt-get install -y nginx
}

configure_nginx_site() {
  local repo_dir="$1"
  local domain="$2"
  if [[ "$CONFIGURE_NGINX" != "yes" ]]; then
    log "Skipping nginx configuration by operator choice"
    return 0
  fi
  local site_name
  site_name="$(safe_site_name "$domain")"
  local config_path="$repo_dir/.auto-forge/nginx/${site_name}.conf"
  run "Install and reload Auto Forge nginx site" bash "$repo_dir/scripts/configure-nginx.sh" "$config_path" "$site_name"
}

configure_tls() {
  local domain="$1"
  if [[ "$CONFIGURE_NGINX" != "yes" || "$ENABLE_TLS" != "yes" ]]; then
    return 0
  fi
  run "Install Certbot nginx plugin" apt-get install -y certbot python3-certbot-nginx
  local certbot_args=(--nginx -d "$domain" --non-interactive --agree-tos --redirect)
  if [[ -n "$CERTBOT_EMAIL" ]]; then
    certbot_args+=(-m "$CERTBOT_EMAIL")
  else
    certbot_args+=(--register-unsafely-without-email)
  fi
  run "Request and install HTTPS certificate with Certbot" certbot "${certbot_args[@]}"
}

configure_telegram_webhook() {
  if [[ "$PUBLIC_BASE_URL" != https://* ]]; then
    log "Skipping Telegram webhook registration because the public base URL is not HTTPS"
    return 0
  fi
  local webhook_url="${PUBLIC_BASE_URL%/}/telegram/webhook"
  if is_dry_run; then
    log "DRY RUN: register Telegram webhook at $webhook_url"
    return 0
  fi
  [[ -n "${TELEGRAM_BOT_TOKEN:-}" ]] || die "Telegram bot token is required to register the Telegram webhook"
  [[ -n "${TELEGRAM_WEBHOOK_SECRET:-}" ]] || die "Telegram webhook secret is required to register the Telegram webhook"
  log "Register Telegram webhook at $webhook_url"
  curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
    -H "content-type: application/json" \
    -d "{\"url\":\"$webhook_url\",\"allowed_updates\":[\"message\"],\"secret_token\":\"$TELEGRAM_WEBHOOK_SECRET\"}" >/dev/null
}

check_public_reachability() {
  if is_dry_run; then
    log "DRY RUN: verify public API and web reachability through $PUBLIC_BASE_URL"
    return 0
  fi

  local live_url="${PUBLIC_BASE_URL%/}/live"
  log "Verify public API reachability at $live_url"
  curl -fsS --max-time 15 "$live_url" >/dev/null

  log "Verify public web reachability at $PUBLIC_BASE_URL"
  curl -fsS --max-time 15 "$PUBLIC_BASE_URL" >/dev/null
}

run_compose_deploy() {
  local repo_dir="$1"
  if is_dry_run; then
    log "DRY RUN: docker compose build"
    log "DRY RUN: docker compose up -d postgres api worker web"
    log "DRY RUN: docker compose run --rm smoke"
    return 0
  fi
  (
    cd "$repo_dir"
    export AUTO_FORGE_RUNTIME_ENV_FILE="$RUNTIME_ENV_FILE"
    export AUTO_FORGE_HOST_DATA_DIR="$HOST_DATA_DIR"
    export AUTO_FORGE_COMPOSE_SETUP_PATH="/data/setup.json"
    docker compose build
    docker compose up -d postgres api worker web
    docker compose -f docker-compose.yml -f docker-compose.smoke.yml run --rm smoke
  )
}

run_live_smoke_gate() {
  local repo_dir="$1"
  if is_dry_run; then
    log "DRY RUN: run npm run live:smoke with runtime env loaded"
    return 0
  fi
  set -a
  # shellcheck disable=SC1090
  . "$RUNTIME_ENV_FILE"
  set +a
  if (cd "$repo_dir" && CODEX_HOME="$CODEX_HOME_DIR" npm run live:smoke); then
    log "Live external smoke passed"
  else
    log "BLOCKED_EXTERNAL: deployment is running, but live Telegram/OpenClaw/OpenAI/DNS validation did not pass. Rerun this installer after external dependencies are ready."
    return 2
  fi
}

main() {
  check_root
  INSTALL_DIR="$(prompt_required "Install directory" "$INSTALL_DIR")"
  RUNTIME_ENV_FILE="$(prompt_required "Runtime env file" "$RUNTIME_ENV_FILE")"
  apply_existing_runtime_env_defaults
  [[ -n "$HOST_DATA_DIR" ]] || HOST_DATA_DIR="$INSTALL_DIR/$DEFAULT_HOST_DATA_SUBDIR"
  PUBLIC_BASE_URL="$(normalize_base_url "$(prompt_required "Controller public domain or base URL" "${PUBLIC_BASE_URL:-https://forge.example.com}")")"
  CONFIGURE_NGINX="$(prompt_bool "Configure nginx automatically" "${CONFIGURE_NGINX:-yes}")"
  local default_enable_tls="no"
  if [[ "$PUBLIC_BASE_URL" == https://* && "$CONFIGURE_NGINX" == "yes" ]]; then
    default_enable_tls="yes"
  fi
  ENABLE_TLS="$(prompt_bool "Enable HTTPS through Certbot when DNS is ready" "${ENABLE_TLS:-$default_enable_tls}")"
  if [[ "$ENABLE_TLS" == "yes" ]]; then
    CERTBOT_EMAIL="$(prompt_value "Certbot email" "$CERTBOT_EMAIL")"
  fi
  OPENCLAW_SETUP_MODE="$(prompt_required "OpenClaw setup mode: detect-existing, install-or-onboard, configure-later, or advanced-webhook" "$OPENCLAW_SETUP_MODE")"
  if [[ "$OPENCLAW_SETUP_MODE" != "detect-existing" || -n "$OPENCLAW_BASE_URL" ]]; then
    OPENCLAW_BASE_URL="$(prompt_required "OpenClaw gateway URL" "${OPENCLAW_BASE_URL:-http://localhost:18789}")"
  fi
  pause_existing_openclaw_gateway_for_installer_onboarding
  TELEGRAM_BOT_TOKEN="$(prompt_secret "Telegram bot token" "${TELEGRAM_BOT_TOKEN:-}")"
  if [[ "${TELEGRAM_CHAT_ID:-}" == "" ]]; then
    TELEGRAM_CHAT_ID="$(prompt_value 'Telegram chat ID, or "discover" to call getUpdates' "discover")"
  fi
  TELEGRAM_CHAT_ID="$(discover_telegram_chat_id "$TELEGRAM_BOT_TOKEN" "$TELEGRAM_CHAT_ID")"
  if [[ -z "$CODEX_AUTH_MODE" ]]; then
    if [[ -n "${OPENAI_API_KEY:-}" ]]; then
      CODEX_AUTH_MODE="api-key"
    else
      CODEX_AUTH_MODE="oauth"
    fi
  fi
  CODEX_AUTH_MODE="$(prompt_required "Codex auth mode: oauth or api-key" "$CODEX_AUTH_MODE")"

  log "Install directory: $INSTALL_DIR"
  log "Runtime env file: $RUNTIME_ENV_FILE"
  log "Compose data directory: $HOST_DATA_DIR"
  log "Public base URL: $PUBLIC_BASE_URL"
  log "Codex auth mode: $CODEX_AUTH_MODE"
  log "Secret values: redacted"

  check_supported_os
  install_base_prerequisites
  ensure_node
  ensure_docker
  local repo_dir
  repo_dir="$(prepare_repo)"

  run "Bootstrap repo dependencies and install-checks" env AUTO_FORGE_BOOTSTRAP_CONTEXT=installer bash "$repo_dir/scripts/bootstrap.sh" --installer

  ensure_openclaw_gateway
  configure_codex_auth "$repo_dir"
  ensure_telegram_webhook_secret_value
  write_compose_project_env "$repo_dir"
  run_setup_wizard "$repo_dir"
  ensure_nginx
  local domain
  domain="$(domain_from_url "$PUBLIC_BASE_URL")"
  configure_nginx_site "$repo_dir" "$domain"
  configure_tls "$domain"
  run_compose_deploy "$repo_dir"
  if ! check_public_reachability; then
    log "BLOCKED_EXTERNAL: public URL is not reachable. Check DNS, firewall ports 80/443, nginx, and Certbot output, then rerun this installer."
    return 2
  fi
  configure_telegram_webhook
  run_live_smoke_gate "$repo_dir" || true
  configure_telegram_webhook

  log "Final status: installer completed deterministic deployment steps. If live smoke reported BLOCKED_EXTERNAL, resolve external credentials/DNS/OpenClaw and rerun this installer."
}

main "$@"
