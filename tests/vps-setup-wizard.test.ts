import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  buildControllerSetup,
  buildVpsEnvValues,
  discoverOpenClawGateway,
  discoverTelegramChatIds,
  generateNginxConfig,
  selectTelegramChatId,
  writeEnvBlock
} from "../packages/ops/src/index.js";
import { FileSetupStore } from "../packages/adapters/src/index.js";

const execFileAsync = promisify(execFile);
const subprocessTimeoutMs = 30_000;
const subprocessTestTimeoutMs = subprocessTimeoutMs + 15_000;

describe("fresh VPS setup wizard helpers", () => {
  it("generates deterministic Nginx routing for web and controller API paths", () => {
    const config = generateNginxConfig({
      serverName: "forge.example.com",
      apiPort: 3001,
      webPort: 5174
    });

    expect(config).toContain("server_name forge.example.com;");
    expect(config).toContain("server 127.0.0.1:3001;");
    expect(config).toContain("server 127.0.0.1:5174;");
    expect(config).toContain("proxy_set_header Host $host;");
    expect(config).toContain("proxy_set_header X-Forwarded-Proto $scheme;");
    expect(config).toContain("proxy_set_header X-Real-IP $remote_addr;");
    expect(config).toContain("proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;");
    expect(config).toContain("location = /health");
    expect(config).toContain("location = /live");
    expect(config).toContain("location ^~ /setup");
    expect(config).toContain("location = /telegram/command");
    expect(config).toContain("location = /telegram/webhook");
    expect(config).toContain("location ^~ /approvals/");
    expect(config).toContain("location ^~ /workflow/");
    expect(config).toContain("location ^~ /tasks");
    expect(config).toContain("TLS note");
    expect(config).not.toContain("raw-openclaw-token");
    expect(config).not.toContain("raw-telegram-token");
  });

  it("writes raw secrets only to ignored env files and persists setup as secret references", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-forge-vps-setup-"));
    const envPath = join(root, ".env");
    const setupPath = join(root, ".auto-forge", "setup.json");
    await mkdir(join(root, ".auto-forge"), { recursive: true });

    const setup = buildControllerSetup({
      openClawBaseUrl: "https://openclaw.example.com/",
      openClawMode: "advanced-webhook",
      openClawToken: { envName: "OPENCLAW_TOKEN", value: "raw-openclaw-token" },
      telegramBotToken: { envName: "TELEGRAM_BOT_TOKEN", value: "raw-telegram-token" },
      telegramTestChatId: "-100123",
      now: new Date("2026-04-28T00:00:00.000Z")
    });
    const envValues = buildVpsEnvValues({
      publicBaseUrl: "https://forge.example.com",
      apiPort: 3000,
      webPort: 5173,
      openClawBaseUrl: "https://openclaw.example.com",
      openClawMode: "advanced-webhook",
      openClawToken: { envName: "OPENCLAW_TOKEN", value: "raw-openclaw-token" },
      telegramBotToken: { envName: "TELEGRAM_BOT_TOKEN", value: "raw-telegram-token" },
      telegramTestChatId: "-100123",
      telegramOperatorChatId: "-100123",
      telegramOperatorUserId: "7375937847",
      codexAuthRef: "env:OPENAI_API_KEY",
      codexApiKey: { envName: "OPENAI_API_KEY", value: "raw-openai-key" },
      hostDataDir: "/opt/auto-forge-controller/.auto-forge/compose-data",
      codexAuthSourceDir: "/root/.codex",
      setupPath
    });

    await writeEnvBlock(envPath, envValues);
    await new FileSetupStore(setupPath).write(setup);

    const envFile = await readFile(envPath, "utf8");
    expect(envFile).toContain("OPENCLAW_TOKEN=raw-openclaw-token");
    expect(envFile).toContain("TELEGRAM_BOT_TOKEN=raw-telegram-token");
    expect(envFile).toContain("TELEGRAM_OPERATOR_CHAT_ID=-100123");
    expect(envFile).toContain("TELEGRAM_OPERATOR_USER_ID=7375937847");
    expect(envFile).toContain("OPENAI_API_KEY=raw-openai-key");
    expect(envFile).toContain("DATABASE_URL=postgres://auto_forge:auto_forge@postgres:5432/auto_forge");
    expect(envFile).toContain("AUTO_FORGE_RUNTIME_CONTEXT=host");
    expect(envFile).toContain("AUTO_FORGE_HOST_DATA_DIR=/opt/auto-forge-controller/.auto-forge/compose-data");
    expect(envFile).toContain("AUTO_FORGE_WORKER_HEALTH_PATH=/data/worker-health.json");
    expect(envFile).toContain("CODEX_HOME=/opt/auto-forge-controller/.auto-forge/compose-data/codex-home");
    expect(envFile).toContain("AUTO_FORGE_ARTIFACT_ROOT=/opt/auto-forge-controller/.auto-forge/compose-data/artifacts");
    expect(envFile).toContain("AUTO_FORGE_CODEX_AUTH_SOURCE_DIR=/root/.codex");
    expect((await stat(envPath)).mode & 0o777).toBe(0o600);

    const setupJson = await readFile(setupPath, "utf8");
    expect(setupJson).toContain("env:OPENCLAW_TOKEN");
    expect(setupJson).toContain("env:TELEGRAM_BOT_TOKEN");
    expect(setupJson).not.toContain("raw-openclaw-token");
    expect(setupJson).not.toContain("raw-telegram-token");
    expect(setupJson).not.toContain("raw-openai-key");
  });

  it("creates a missing runtime env file through the npm setup command", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-forge-setup-command-"));
    const envPath = join(root, ".env");
    const setupPath = join(root, "setup.json");

    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "setup:vps",
        "--",
        "--non-interactive",
        "--public-base-url",
        "https://forge.example.com",
        "--api-port",
        "3000",
        "--web-port",
        "5173",
        "--openclaw-base-url",
        "https://openclaw.example.com",
        "--telegram-bot-token-ref",
        "env:TELEGRAM_BOT_TOKEN",
        "--telegram-chat-id",
        "-100123",
        "--codex-auth-ref",
        "env:OPENAI_API_KEY",
        "--runtime-env-file",
        envPath,
        "--setup-path",
        setupPath
      ],
      {
        cwd: process.cwd(),
        timeout: subprocessTimeoutMs,
        env: {
          ...process.env,
          PATH: "/usr/bin:/bin",
          OPENCLAW_CLI_COMMAND: undefined
        }
      }
    );

    const output = JSON.parse(stdout.slice(stdout.indexOf("{"))) as { ok: boolean; envFile: string; setupPath: string };
    expect(output.ok).toBe(true);
    expect(output.envFile).toBe(envPath);
    expect(output.setupPath).toBe(setupPath);
    expect((await stat(envPath)).mode & 0o777).toBe(0o600);

    const setupJson = await readFile(setupPath, "utf8");
    expect(setupJson).toContain('"mode": "detect-existing"');
    expect(setupJson).toContain('"source": "manual"');
    expect(setupJson).toContain("Using explicit OpenClaw gateway URL");
    expect(setupJson).toContain("env:TELEGRAM_BOT_TOKEN");
    expect(setupJson).not.toContain("OPENCLAW_TOKEN");
    expect(setupJson).not.toContain("raw-");
  }, subprocessTestTimeoutMs);

  it("fails closed without writing setup JSON when default OpenClaw discovery is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-forge-default-openclaw-"));
    const envPath = join(root, ".env");
    const setupPath = join(root, "setup.json");

    await expect(
      execFileAsync(
        "npm",
        [
          "run",
          "setup:vps",
          "--",
          "--non-interactive",
          "--public-base-url",
          "https://forge.example.com",
          "--api-port",
          "3000",
          "--web-port",
          "5173",
          "--telegram-bot-token-ref",
          "env:TELEGRAM_BOT_TOKEN",
          "--telegram-chat-id",
          "-100123",
          "--codex-auth-ref",
          "env:OPENAI_API_KEY",
          "--runtime-env-file",
          envPath,
          "--setup-path",
          setupPath
        ],
        {
          cwd: process.cwd(),
          timeout: subprocessTimeoutMs,
          env: {
            ...process.env,
            PATH: "/usr/bin:/bin",
            OPENCLAW_BASE_URL: undefined,
            OPENCLAW_SETUP_MODE: undefined,
            OPENCLAW_CLI_COMMAND: undefined
          }
        }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("OpenClaw CLI is not installed or not on PATH")
    });

    await expect(stat(setupPath)).rejects.toMatchObject({ code: "ENOENT" });
  }, subprocessTestTimeoutMs);

  it("writes an explicit incomplete setup when configure-later is selected", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-forge-configure-later-"));
    const envPath = join(root, ".env");
    const setupPath = join(root, "setup.json");

    await execFileAsync(
      "npm",
      [
        "run",
        "setup:vps",
        "--",
        "--non-interactive",
        "--openclaw-mode",
        "configure-later",
        "--openclaw-base-url",
        "http://localhost:18789",
        "--public-base-url",
        "https://forge.example.com",
        "--api-port",
        "3000",
        "--web-port",
        "5173",
        "--telegram-bot-token-ref",
        "env:TELEGRAM_BOT_TOKEN",
        "--telegram-chat-id",
        "-100123",
        "--codex-auth-ref",
        "env:OPENAI_API_KEY",
        "--runtime-env-file",
        envPath,
        "--setup-path",
        setupPath
      ],
      { cwd: process.cwd(), timeout: subprocessTimeoutMs }
    );

    const setupJson = await readFile(setupPath, "utf8");
    expect(setupJson).toContain('"mode": "configure-later"');
    expect(setupJson).toContain('"status": "configure-later"');
    expect(setupJson).toContain('"source": "deferred"');
  }, subprocessTestTimeoutMs);

  it("discovers an existing OpenClaw gateway through the OpenClaw CLI", async () => {
    const discovery = await discoverOpenClawGateway({
      mode: "detect-existing",
      execFileImpl: ((
        command: string,
        args: string[],
        ...rest: unknown[]
      ) => {
        expect(command).toBe("openclaw");
        expect(args).toEqual(["gateway", "status", "--json", "--require-rpc"]);
        const callback = rest.at(-1) as (error: Error | null, stdout: string, stderr: string) => void;
        callback(null, JSON.stringify({ baseUrl: "http://127.0.0.1:18789", agentHookPath: "/hooks/agent" }), "");
      }) as never
    });

    expect(discovery).toMatchObject({
      ok: true,
      mode: "detect-existing",
      baseUrl: "http://127.0.0.1:18789",
      source: "openclaw-cli",
      status: "detected"
    });
    expect(JSON.stringify(discovery)).not.toContain("OPENCLAW_TOKEN");
  });

  it("reports a clear OpenClaw onboarding next step when the CLI is missing", async () => {
    const discovery = await discoverOpenClawGateway({
      mode: "install-or-onboard",
      execFileImpl: ((
        command: string,
        args: string[],
        ...rest: unknown[]
      ) => {
        void command;
        void args;
        const callback = rest.at(-1) as (error: Error | null, stdout: string, stderr: string) => void;
        const error = new Error("spawn openclaw ENOENT") as Error & { code: string };
        error.code = "ENOENT";
        callback(error, "", "");
      }) as never
    });

    expect(discovery.ok).toBe(false);
    expect(discovery.status).toBe("missing-cli");
    expect(discovery.nextStep).toContain("Install OpenClaw");
  });

  it("uses an explicit OpenClaw gateway URL after installer onboarding when CLI status omits a URL", async () => {
    const discovery = await discoverOpenClawGateway({
      mode: "install-or-onboard",
      explicitBaseUrl: "http://localhost:18789",
      execFileImpl: ((
        command: string,
        args: string[],
        ...rest: unknown[]
      ) => {
        expect(command).toBe("openclaw");
        expect(args).toEqual(["gateway", "status", "--json", "--require-rpc"]);
        const callback = rest.at(-1) as (error: Error | null, stdout: string, stderr: string) => void;
        callback(null, JSON.stringify({ rpc: { ok: true } }), "");
      }) as never
    });

    expect(discovery).toMatchObject({
      ok: true,
      mode: "install-or-onboard",
      baseUrl: "http://localhost:18789",
      source: "manual",
      status: "detected"
    });
    expect(discovery.nextStep).toBeUndefined();
  });

  it("does not treat missing OPENCLAW_TOKEN as a default live-smoke blocker", async () => {
    await expect(
      execFileAsync("npm", ["run", "live:smoke"], {
        cwd: process.cwd(),
        timeout: subprocessTimeoutMs,
        env: {
          PATH: process.env.PATH,
          npm_config_cache: process.env.npm_config_cache,
          OPENCLAW_BASE_URL: "http://127.0.0.1:18789",
          OPENCLAW_SETUP_MODE: "detect-existing"
        }
      })
    ).rejects.toMatchObject({
      stdout: expect.not.stringContaining("OPENCLAW_TOKEN")
    });
  }, subprocessTestTimeoutMs);

  it("does not require OPENAI_API_KEY for OAuth-backed live smoke configuration", async () => {
    await expect(
      execFileAsync("npm", ["run", "live:smoke"], {
        cwd: process.cwd(),
        timeout: subprocessTimeoutMs,
        env: {
          PATH: process.env.PATH,
          npm_config_cache: process.env.npm_config_cache,
          CODEX_AUTH_REF: "secret:codex-oauth-local-cache"
        }
      })
    ).rejects.toMatchObject({
      stdout: expect.not.stringContaining("OPENAI_API_KEY")
    });
  }, subprocessTestTimeoutMs);

  it("discovers Telegram chat IDs from getUpdates without returning the token", async () => {
    const chats = await discoverTelegramChatIds({
      botToken: "123456:raw-telegram-token",
      apiBaseUrl: "https://telegram.test",
      fetchImpl: async (url) => {
        expect(String(url)).toContain("123456:raw-telegram-token");
        return Response.json({
          ok: true,
          result: [
            { message: { chat: { id: -100123, type: "supergroup", title: "Forge Ops" }, from: { id: 7375937847 } } },
            { channel_post: { chat: { id: -100456, type: "channel", title: "Deploys" } } },
            { message: { chat: { id: -100123, type: "supergroup", title: "Forge Ops" } } }
          ]
        });
      }
    });

    expect(chats).toEqual([
      { chatId: "-100123", userId: "7375937847", type: "supergroup", title: "Forge Ops" },
      { chatId: "-100456", type: "channel", title: "Deploys" }
    ]);
    expect(JSON.stringify(chats)).not.toContain("raw-telegram-token");
  });

  it("retries Telegram chat discovery after an empty getUpdates result", async () => {
    let discoverCalls = 0;
    const messages: string[] = [];

    const chatId = await selectTelegramChatId({
      initialAnswer: "discover",
      discoverChats: async () => {
        discoverCalls += 1;
        return discoverCalls === 1
          ? []
          : [{ chatId: "-100789", type: "supergroup", title: "Forge Ops" }];
      },
      promptDiscoveredChat: async (candidates) => candidates[0]?.chatId ?? "",
      promptManualChatId: async () => {
        throw new Error("manual chat ID should not be requested");
      },
      promptDiscoveryFallback: async ({ reason }) => {
        expect(reason).toBe("empty");
        return "retry";
      },
      onMessage: (message) => messages.push(message)
    });

    expect(chatId).toBe("-100789");
    expect(discoverCalls).toBe(2);
    expect(messages.join("\n")).toContain("retry discovery or enter the chat ID manually");
    expect(messages.join("\n")).not.toContain("raw-telegram-token");
  });

  it("falls back to manual Telegram chat ID entry after empty discovery", async () => {
    const chatId = await selectTelegramChatId({
      initialAnswer: "discover",
      discoverChats: async () => [],
      promptDiscoveredChat: async () => {
        throw new Error("discovered chat prompt should not be requested");
      },
      promptManualChatId: async () => "-100999",
      promptDiscoveryFallback: async ({ reason, message }) => {
        expect(reason).toBe("empty");
        expect(message).toContain("Send a message to the bot");
        return "manual";
      }
    });

    expect(chatId).toBe("-100999");
  });

  it("uses Codex device auth without magic confirmation phrases in the setup wizard", async () => {
    const source = await readFile(join(process.cwd(), "apps/cli/src/index.ts"), "utf8");

    expect(source).not.toContain(["I", "UNDERSTAND"].join(" "));
    expect(source).toContain('["login", "--device-auth"]');
    expect(source).toContain('["login", "status"]');
    expect(source).not.toMatch(/\["login"\]/);
  });
});
