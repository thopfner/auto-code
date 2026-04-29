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
CODEX_AUTH_MODE="${AUTO_FORGE_CODEX_AUTH_MODE:-}"
CODEX_AUTH_REF=""
CODEX_HOME_DIR="${AUTO_FORGE_CODEX_HOME_DIR:-$DEFAULT_CODEX_HOME_DIR}"
API_PORT="${AUTO_FORGE_API_PORT:-$DEFAULT_API_PORT}"
WEB_PORT="${AUTO_FORGE_WEB_PORT:-$DEFAULT_WEB_PORT}"
HOST_DATA_DIR="${AUTO_FORGE_HOST_DATA_DIR:-}"

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
  TELEGRAM_TEST_CHAT_ID, AUTO_FORGE_CODEX_AUTH_MODE, OPENAI_API_KEY,
  AUTO_FORGE_CODEX_HOME_DIR
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
  if is_dry_run || [[ -n "$default_value" && "$ASSUME_YES" == "1" ]]; then
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
  if is_dry_run || [[ -n "$default_value" && "$ASSUME_YES" == "1" ]]; then
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
  if is_dry_run || [[ "$ASSUME_YES" == "1" ]]; then
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

discover_telegram_chat_id() {
  local token="$1"
  local current="$2"
  if [[ -n "$current" && "$current" != "discover" ]]; then
    printf '%s\n' "$current"
    return 0
  fi
  if is_dry_run; then
    printf '%s\n' "${current:-discover}"
    return 0
  fi
  while true; do
    log "Discovering Telegram chats with getUpdates. The bot token will not be printed."
    local payload
    if ! payload="$(curl -fsS -X POST "https://api.telegram.org/bot${token}/getUpdates" \
      -H "content-type: application/json" \
      -d '{"allowed_updates":["message","channel_post","my_chat_member"]}')"; then
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
  const label = chat.title || chat.username || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.type || "chat";
  console.log(`${chat.id}\t${label}`);
}
')" || chats=""
      if [[ -n "$chats" ]]; then
        printf '%s\n' "$chats" >/dev/tty
        prompt_required "Telegram chat ID to use" "$(printf '%s\n' "$chats" | head -n 1 | cut -f1)"
        return 0
      fi
      log "Telegram returned no chats. Send a message to the bot, then retry or enter the chat ID manually."
    fi

    local action
    action="$(prompt_value 'Type "retry" or "manual"' "retry")"
    if [[ "$action" != "retry" ]]; then
      prompt_required "Telegram chat ID" ""
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

ensure_openclaw_gateway() {
  if [[ "$OPENCLAW_SETUP_MODE" != "install-or-onboard" ]]; then
    return 0
  fi
  if is_dry_run; then
    log "DRY RUN: install OpenClaw CLI if missing"
    log "DRY RUN: write gateway.mode=local OpenClaw config non-interactively"
    log "DRY RUN: install/start OpenClaw gateway non-interactively"
    log "DRY RUN: install/start /etc/systemd/system/openclaw-gateway.service if OpenClaw's own service install does not produce a healthy gateway"
    log "DRY RUN: verify OpenClaw gateway with openclaw gateway status --json --require-rpc, or continue with Auto Forge onboarding if not ready"
    return 0
  fi
  if ! command -v openclaw >/dev/null 2>&1; then
    run_shell "Install OpenClaw CLI" "curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash -s -- --no-onboard"
  fi
  if openclaw gateway status --json --require-rpc >/dev/null 2>&1; then
    log "OpenClaw gateway is already running"
    return 0
  fi
  if ! ensure_openclaw_local_gateway_config; then
    log "OpenClaw local gateway config could not be initialized automatically"
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
    --codex-auth-ref "$CODEX_AUTH_REF"
  )
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
    OPENAI_API_KEY="${OPENAI_API_KEY:-}" \
    CODEX_HOME="$CODEX_HOME_DIR" \
    npm "${setup_args[@]}"
  )
  chmod 0600 "$RUNTIME_ENV_FILE"
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
  [[ -n "$HOST_DATA_DIR" ]] || HOST_DATA_DIR="$INSTALL_DIR/$DEFAULT_HOST_DATA_SUBDIR"
  PUBLIC_BASE_URL="$(normalize_base_url "$(prompt_required "Controller public domain or base URL" "${PUBLIC_BASE_URL:-https://forge.example.com}")")"
  CONFIGURE_NGINX="$(prompt_bool "Configure nginx automatically" "${CONFIGURE_NGINX:-yes}")"
  ENABLE_TLS="$(prompt_bool "Enable HTTPS through Certbot when DNS is ready" "${ENABLE_TLS:-no}")"
  if [[ "$ENABLE_TLS" == "yes" ]]; then
    CERTBOT_EMAIL="$(prompt_value "Certbot email" "$CERTBOT_EMAIL")"
  fi
  OPENCLAW_SETUP_MODE="$(prompt_required "OpenClaw setup mode: detect-existing, install-or-onboard, configure-later, or advanced-webhook" "$OPENCLAW_SETUP_MODE")"
  if [[ "$OPENCLAW_SETUP_MODE" != "detect-existing" || -n "$OPENCLAW_BASE_URL" ]]; then
    OPENCLAW_BASE_URL="$(prompt_required "OpenClaw gateway URL" "${OPENCLAW_BASE_URL:-http://localhost:18789}")"
  fi
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
  write_compose_project_env "$repo_dir"
  run_setup_wizard "$repo_dir"
  ensure_nginx
  local domain
  domain="$(domain_from_url "$PUBLIC_BASE_URL")"
  configure_nginx_site "$repo_dir" "$domain"
  configure_tls "$domain"
  run_compose_deploy "$repo_dir"
  run_live_smoke_gate "$repo_dir" || true

  log "Final status: installer completed deterministic deployment steps. If live smoke reported BLOCKED_EXTERNAL, resolve external credentials/DNS/OpenClaw and rerun this installer."
}

main "$@"
