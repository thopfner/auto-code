import { execFile } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("one-command VPS installer", () => {
  it("has valid bash syntax", async () => {
    await expect(execFileAsync("bash", ["-n", "scripts/install-vps.sh"], { cwd: process.cwd() })).resolves.toBeDefined();
    await expect(execFileAsync("bash", ["-n", "scripts/bootstrap.sh"], { cwd: process.cwd() })).resolves.toBeDefined();
    await expect(execFileAsync("bash", ["-n", "scripts/setup-openclaw.sh"], { cwd: process.cwd() })).resolves.toBeDefined();
  });

  it("prints a dry-run deployment plan without leaking raw secrets", async () => {
    const telegramToken = "redacted-test-telegram-token";
    const openAiKey = "redacted-test-openai-key";
    const { stdout, stderr } = await execFileAsync("bash", ["scripts/install-vps.sh", "--dry-run"], {
      cwd: process.cwd(),
      timeout: 30_000,
      env: {
        ...process.env,
        AUTO_FORGE_INSTALL_DRY_RUN: "1",
        AUTO_FORGE_PUBLIC_BASE_URL: "https://forge.example.com",
        AUTO_FORGE_CONFIGURE_NGINX: "yes",
        AUTO_FORGE_ENABLE_TLS: "yes",
        AUTO_FORGE_CERTBOT_EMAIL: "ops@example.com",
        OPENCLAW_SETUP_MODE: "configure-later",
        OPENCLAW_BASE_URL: "http://localhost:18789",
        TELEGRAM_BOT_TOKEN: telegramToken,
        OPENAI_API_KEY: openAiKey
      }
    });
    const output = `${stdout}\n${stderr}`;

    expect(output).toContain("Install directory: /opt/auto-forge-controller");
    expect(output).toContain("Runtime env file: /etc/auto-forge-controller/auto-forge.env");
    expect(output).toContain("Codex auth mode: api-key");
    expect(output).toContain("Install Docker official apt repository key");
    expect(output).toContain("Install Docker Engine and Compose plugin");
    expect(output).toContain("run setup wizard with runtime env /etc/auto-forge-controller/auto-forge.env");
    expect(output).toContain("docker compose build");
    expect(output).toContain("docker compose up -d postgres api worker web");
    expect(output).toContain("docker compose run --rm smoke");
    expect(output).toContain("Install Certbot nginx plugin");
    expect(output).toContain("Secret values: redacted");
    expect(output).not.toContain("Edit .env");
    expect(output).not.toContain("start API/worker/web manually");
    expect(output).not.toContain(telegramToken);
    expect(output).not.toContain(openAiKey);
  });

  it("supports OAuth dry-run without leaking API-key requirements", async () => {
    const { stdout, stderr } = await execFileAsync("bash", ["scripts/install-vps.sh", "--dry-run"], {
      cwd: process.cwd(),
      timeout: 30_000,
      env: {
        ...process.env,
        AUTO_FORGE_INSTALL_DRY_RUN: "1",
        AUTO_FORGE_PUBLIC_BASE_URL: "https://forge.example.com",
        AUTO_FORGE_CODEX_AUTH_MODE: "oauth",
        OPENCLAW_SETUP_MODE: "configure-later",
        OPENCLAW_BASE_URL: "http://localhost:18789",
        TELEGRAM_BOT_TOKEN: "redacted-test-telegram-token"
      }
    });
    const output = `${stdout}\n${stderr}`;

    expect(output).toContain("Codex auth mode: oauth");
    expect(output).toContain("run Codex OAuth device auth with repo-managed Codex CLI");
    expect(output).not.toContain("OpenAI API key for Codex");
    expect(output).not.toContain("The one-command installer supports Codex API-key auth only");
  });

  it("uses installer-aware bootstrap output without removing standalone guidance", async () => {
    const installer = await readFile("scripts/install-vps.sh", "utf8");
    const bootstrap = await readFile("scripts/bootstrap.sh", "utf8");

    expect(installer).toContain("AUTO_FORGE_BOOTSTRAP_CONTEXT=installer");
    expect(installer).toContain("--installer");
    expect(bootstrap).toContain('BOOTSTRAP_CONTEXT="installer"');
    expect(bootstrap).toContain("Bootstrap checks complete for the VPS installer.");
    expect(bootstrap).toContain("Created .env from .env.example for installer bootstrap.");
    expect(bootstrap).toContain("Bootstrap complete.");
    expect(bootstrap).toContain("Edit .env and provide OPENAI_API_KEY");
  });

  it("creates a missing env file in installer bootstrap without standalone manual guidance", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-forge-bootstrap-installer-"));
    await mkdir(join(root, "scripts"), { recursive: true });
    await mkdir(join(root, "fakebin"), { recursive: true });
    await mkdir(join(root, "node_modules", ".bin"), { recursive: true });
    await copyFile("scripts/bootstrap.sh", join(root, "scripts", "bootstrap.sh"));
    await copyFile(".env.example", join(root, ".env.example"));
    await writeFile(join(root, "fakebin", "npm"), "#!/usr/bin/env bash\nexit 0\n");
    await chmod(join(root, "fakebin", "npm"), 0o755);
    await writeFile(join(root, "node_modules", ".bin", "codex"), "#!/usr/bin/env bash\nexit 0\n");
    await chmod(join(root, "node_modules", ".bin", "codex"), 0o755);

    const { stdout, stderr } = await execFileAsync("bash", ["./scripts/bootstrap.sh", "--installer"], {
      cwd: root,
      timeout: 30_000,
      env: {
        ...process.env,
        AUTO_FORGE_BOOTSTRAP_CONTEXT: "installer",
        PATH: `${join(root, "fakebin")}:${process.env.PATH ?? ""}`
      }
    });
    const output = `${stdout}\n${stderr}`;

    expect(await readFile(join(root, ".env"), "utf8")).toBe(await readFile(".env.example", "utf8"));
    expect((await stat(join(root, ".env"))).mode & 0o777).toBe(0o600);
    expect(output).toContain("Created .env from .env.example for installer bootstrap.");
    expect(output).toContain("The VPS installer will replace it with Compose env pointers and write runtime secret references.");
    expect(output).toContain("Bootstrap checks complete for the VPS installer.");
    expect(output).toContain("The installer will continue with runtime env creation");
    expect(output).not.toContain("Replace secret environment values before live onboarding");
    expect(output).not.toContain("Edit .env");
    expect(output).not.toContain("start API/worker/web");
    expect(output).not.toContain("codex login --device-auth");
  });

  it("supports coherent installer Codex auth modes", async () => {
    const source = await readFile("scripts/install-vps.sh", "utf8");

    expect(source).toContain("Codex auth mode: oauth or api-key");
    expect(source).toContain('CODEX_AUTH_REF="secret:codex-oauth-local-cache"');
    expect(source).toContain('CODEX_AUTH_REF="env:OPENAI_API_KEY"');
    expect(source).toContain("--codex-auth-ref \"$CODEX_AUTH_REF\"");
    expect(source).toContain("login --device-auth");
    expect(source).toContain("login status");
    expect(source).not.toContain("The one-command installer supports Codex API-key auth only");
  });

  it("keeps OpenClaw install-or-onboard non-interactive and defers unfinished onboarding", async () => {
    const source = await readFile("scripts/install-vps.sh", "utf8");

    expect(source).toContain('OPENCLAW_SETUP_MODE" != "install-or-onboard"');
    expect(source).toContain("https://openclaw.ai/install.sh");
    expect(source).not.toContain("openclaw onboard --install-daemon");
    expect(source).toContain('run_managed_openclaw_bootstrap "$repo_dir"');
    expect(source).toContain('bash "$repo_dir/scripts/setup-openclaw.sh" --workspace-dir "$workspace_dir"');
    expect(source).toContain("create managed OpenClaw workspace and mark first-run bootstrap complete");
    expect(source).toContain("openclaw config set gateway.mode local");
    expect(source).toContain("openclaw config set gateway.port 18789");
    expect(source).toContain("openclaw config set agents.defaults.workspace /root/.openclaw/workspace");
    expect(source).toContain("validate_openclaw_config");
    expect(source).toContain("openclaw config validate");
    expect(source).toContain("/root/.openclaw/.env");
    expect(source).toContain('token_path="$config_dir/telegram-bot-token"');
    expect(source).toContain("EnvironmentFile=-/root/.openclaw/.env");
    expect(source).toContain("telegram.defaultTo = telegramChatId");
    expect(source).toContain("telegram.dmPolicy = telegram.dmPolicy ?? \"allowlist\"");
    expect(source).toContain("allowFrom.add(telegramChatId)");
    expect(source).toContain("actions: { ...(config.channels.telegram?.actions ?? {}), sendMessage: true }");
    expect(source).toContain("openclaw config set channels.telegram.enabled true");
    expect(source).toContain('openclaw config set channels.telegram.tokenFile "$token_path"');
    expect(source).toContain('openclaw config set channels.telegram.defaultTo "$TELEGRAM_CHAT_ID"');
    expect(source).toContain("OpenClaw gateway restarted after config refresh");
    expect(source).toContain('"mode": "local"');
    expect(source).toContain("openclaw gateway install --port 18789 --runtime node --force --json");
    expect(source).toContain("openclaw gateway start");
    expect(source).toContain("/etc/systemd/system/openclaw-gateway.service");
    expect(source).toContain("ExecStart=$openclaw_path gateway --port 18789");
    expect(source).toContain("systemctl enable --now openclaw-gateway.service");
    expect(source).toContain("openclaw gateway status --json --require-rpc");
    expect(source).toContain('OPENCLAW_SETUP_MODE="configure-later"');
    expect(source).toContain("Continuing Auto Forge deployment with OpenClaw marked configure-later");
  });

  it("runs the managed OpenClaw bootstrap only for install-or-onboard dry runs", async () => {
    const { stdout, stderr } = await execFileAsync("bash", ["scripts/install-vps.sh", "--dry-run"], {
      cwd: process.cwd(),
      timeout: 30_000,
      env: {
        ...process.env,
        AUTO_FORGE_INSTALL_DRY_RUN: "1",
        AUTO_FORGE_PUBLIC_BASE_URL: "https://forge.example.com",
        OPENCLAW_SETUP_MODE: "install-or-onboard",
        OPENCLAW_BASE_URL: "http://localhost:18789",
        TELEGRAM_BOT_TOKEN: "redacted-test-telegram-token",
        OPENAI_API_KEY: "redacted-test-openai-key"
      }
    });
    const output = `${stdout}\n${stderr}`;

    expect(output).toContain("create managed OpenClaw workspace and mark first-run bootstrap complete");
    expect(output).toContain("validate OpenClaw config before gateway restart");
    expect(output).toContain("register and verify Telegram webhook at https://forge.example.com/telegram/webhook");
    expect(output).not.toContain("hopfner.dev");
    expect(output).not.toContain("redacted-test-telegram-token");
    expect(output).not.toContain("redacted-test-openai-key");
  });

  it("registers the Telegram webhook against the controller public URL", async () => {
    const source = await readFile("scripts/install-vps.sh", "utf8");

    expect(source).toContain('local webhook_url="${PUBLIC_BASE_URL%/}/telegram/webhook"');
    expect(source).toContain("Register and verify Telegram webhook at $webhook_url");
    expect(source).toContain('postTelegram("setWebhook"');
    expect(source).toContain('getTelegram("getWebhookInfo")');
    expect(source).toContain('allowed_updates: ["message"]');
    expect(source).toContain("secret_token: secret");
    expect(source).toContain("Telegram webhook verified at");
    expect(source).toContain("Telegram webhook verification failed");
    expect(source).toContain("ensure_telegram_webhook_secret_value");
    expect(source).toContain("configure_telegram_webhook");
    const firstWebhook = source.indexOf("configure_telegram_webhook");
    const smokeGate = source.indexOf('run_live_smoke_gate "$repo_dir"');
    const finalWebhook = source.indexOf("configure_telegram_webhook", smokeGate);
    expect(firstWebhook).toBeGreaterThan(-1);
    expect(smokeGate).toBeGreaterThan(firstWebhook);
    expect(finalWebhook).toBeGreaterThan(smokeGate);
  });

  it("reuses runtime Telegram settings and avoids getUpdates when a webhook is active", async () => {
    const source = await readFile("scripts/install-vps.sh", "utf8");

    expect(source).toContain("apply_existing_runtime_env_defaults");
    expect(source).toContain("REUSE_EXISTING_RUNTIME_ENV_DEFAULTS=1");
    expect(source).toContain("Reusing existing runtime env defaults from $RUNTIME_ENV_FILE");
    expect(source).toContain("read_runtime_env_value TELEGRAM_TEST_CHAT_ID");
    expect(source).toContain("read_runtime_env_value TELEGRAM_OPERATOR_CHAT_ID");
    expect(source).toContain("read_runtime_env_value TELEGRAM_OPERATOR_USER_ID");
    expect(source).toContain("--telegram-operator-chat-id");
    expect(source).toContain("--telegram-operator-user-id");
    expect(source).toContain("user:%s");
    expect(source).toContain("Using existing Telegram chat ID from $RUNTIME_ENV_FILE");
    expect(source).toContain("getWebhookInfo");
    expect(source).toContain("clear_telegram_webhook_for_discovery");
    expect(source).toContain("deleteWebhook");
    expect(source).toContain("Webhook cleared for discovery. Send a fresh message to the bot now; the installer will wait for it.");
    expect(source).toContain('"timeout":30');
    expect(source).toContain("--max-time 35");
    expect(source).toContain("pause_existing_openclaw_gateway_for_installer_onboarding");
    expect(source).toContain("openclaw gateway stop");
  });

  it("defaults HTTPS installs to Certbot and validates public reachability", async () => {
    const source = await readFile("scripts/install-vps.sh", "utf8");

    expect(source).toContain('default_enable_tls="yes"');
    expect(source).toContain("check_public_reachability");
    expect(source).toContain('local live_url="${PUBLIC_BASE_URL%/}/live"');
    expect(source).toContain("BLOCKED_EXTERNAL: public URL is not reachable");
  });

  it("uses the expected default installer paths and executable mode", async () => {
    const source = await readFile("scripts/install-vps.sh", "utf8");
    const mode = (await stat("scripts/install-vps.sh")).mode & 0o777;

    expect(source).toContain('DEFAULT_INSTALL_DIR="/opt/auto-forge-controller"');
    expect(source).toContain('DEFAULT_RUNTIME_ENV_FILE="/etc/auto-forge-controller/auto-forge.env"');
    expect(source).toContain('DEFAULT_CODEX_HOME_DIR="/root/.codex"');
    expect(source).toContain("chmod 0600 \"$RUNTIME_ENV_FILE\"");
    expect(source).toContain("https://download.docker.com/linux/ubuntu");
    expect(source).toContain("docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin");
    expect(source).toContain('AUTO_FORGE_WEB_ALLOWED_HOSTS=$(domain_from_url "$PUBLIC_BASE_URL")');
    expect(mode).toBe(0o755);
  });

  it("aligns Docker Compose with the installer runtime env and setup state", async () => {
    const compose = await readFile("docker-compose.yml", "utf8");
    const smoke = await readFile("docker-compose.smoke.yml", "utf8");
    const combined = `${compose}\n${smoke}`;

    expect(combined).toContain("${AUTO_FORGE_RUNTIME_ENV_FILE:-.env}");
    expect(combined).toContain("${AUTO_FORGE_HOST_DATA_DIR:-.auto-forge/compose-data}:/data");
    expect(combined).toContain("${AUTO_FORGE_CODEX_HOME_DIR:-/root/.codex}:/root/.codex:ro");
    expect((combined.match(/CODEX_HOME: \/root\/\.codex/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((combined.match(/\$\{AUTO_FORGE_CODEX_HOME_DIR:-\/root\/\.codex\}:\/root\/\.codex:ro/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(combined).toContain('AUTO_FORGE_ALLOW_ALL_WEB_HOSTS: "1"');
    expect(combined).toContain('__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: "web,${AUTO_FORGE_WEB_ALLOWED_HOSTS:-}"');
    expect(combined).toContain("AUTO_FORGE_SETUP_PATH: ${AUTO_FORGE_COMPOSE_SETUP_PATH:-/data/setup.json}");
    expect(combined).not.toContain("AUTO_FORGE_PUBLIC_BASE_URL: http://localhost:3000");
    expect(combined).not.toContain("OPENCLAW_BASE_URL: http://openclaw.local");
    expect(combined).not.toContain("TELEGRAM_BOT_TOKEN_REF: env:TELEGRAM_BOT_TOKEN");
    expect(combined).not.toContain("CODEX_AUTH_REF: env:OPENAI_API_KEY");
  });
});
