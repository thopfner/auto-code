import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("one-command VPS installer", () => {
  it("has valid bash syntax", async () => {
    await expect(execFileAsync("bash", ["-n", "scripts/install-vps.sh"], { cwd: process.cwd() })).resolves.toBeDefined();
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
    expect(output).toContain("Install Docker official apt repository key");
    expect(output).toContain("Install Docker Engine and Compose plugin");
    expect(output).toContain("run setup wizard with runtime env /etc/auto-forge-controller/auto-forge.env");
    expect(output).toContain("docker compose build");
    expect(output).toContain("docker compose up -d postgres api worker web");
    expect(output).toContain("docker compose run --rm smoke");
    expect(output).toContain("Install Certbot nginx plugin");
    expect(output).toContain("Secret values: redacted");
    expect(output).not.toContain(telegramToken);
    expect(output).not.toContain(openAiKey);
  });

  it("uses the expected default installer paths and executable mode", async () => {
    const source = await readFile("scripts/install-vps.sh", "utf8");
    const mode = (await stat("scripts/install-vps.sh")).mode & 0o777;

    expect(source).toContain('DEFAULT_INSTALL_DIR="/opt/auto-forge-controller"');
    expect(source).toContain('DEFAULT_RUNTIME_ENV_FILE="/etc/auto-forge-controller/auto-forge.env"');
    expect(source).toContain("chmod 0600 \"$RUNTIME_ENV_FILE\"");
    expect(source).toContain("https://download.docker.com/linux/ubuntu");
    expect(source).toContain("docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin");
    expect(mode).toBe(0o755);
  });

  it("aligns Docker Compose with the installer runtime env and setup state", async () => {
    const compose = await readFile("docker-compose.yml", "utf8");
    const smoke = await readFile("docker-compose.smoke.yml", "utf8");
    const combined = `${compose}\n${smoke}`;

    expect(combined).toContain("${AUTO_FORGE_RUNTIME_ENV_FILE:-.env}");
    expect(combined).toContain("${AUTO_FORGE_HOST_DATA_DIR:-.auto-forge/compose-data}:/data");
    expect(combined).toContain("AUTO_FORGE_SETUP_PATH: ${AUTO_FORGE_COMPOSE_SETUP_PATH:-/data/setup.json}");
    expect(combined).not.toContain("AUTO_FORGE_PUBLIC_BASE_URL: http://localhost:3000");
    expect(combined).not.toContain("OPENCLAW_BASE_URL: http://openclaw.local");
    expect(combined).not.toContain("TELEGRAM_BOT_TOKEN_REF: env:TELEGRAM_BOT_TOKEN");
    expect(combined).not.toContain("CODEX_AUTH_REF: env:OPENAI_API_KEY");
  });
});
