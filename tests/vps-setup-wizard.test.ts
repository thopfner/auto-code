import { mkdir, mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildControllerSetup,
  buildVpsEnvValues,
  discoverTelegramChatIds,
  generateNginxConfig,
  writeEnvBlock
} from "../packages/ops/src/index.js";
import { FileSetupStore } from "../packages/adapters/src/index.js";

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
      openClawToken: { envName: "OPENCLAW_TOKEN", value: "raw-openclaw-token" },
      telegramBotToken: { envName: "TELEGRAM_BOT_TOKEN", value: "raw-telegram-token" },
      telegramTestChatId: "-100123",
      codexAuthRef: "env:OPENAI_API_KEY",
      codexApiKey: { envName: "OPENAI_API_KEY", value: "raw-openai-key" },
      setupPath
    });

    await writeEnvBlock(envPath, envValues);
    await new FileSetupStore(setupPath).write(setup);

    const envFile = await readFile(envPath, "utf8");
    expect(envFile).toContain("OPENCLAW_TOKEN=raw-openclaw-token");
    expect(envFile).toContain("TELEGRAM_BOT_TOKEN=raw-telegram-token");
    expect(envFile).toContain("OPENAI_API_KEY=raw-openai-key");
    expect((await stat(envPath)).mode & 0o777).toBe(0o600);

    const setupJson = await readFile(setupPath, "utf8");
    expect(setupJson).toContain("env:OPENCLAW_TOKEN");
    expect(setupJson).toContain("env:TELEGRAM_BOT_TOKEN");
    expect(setupJson).not.toContain("raw-openclaw-token");
    expect(setupJson).not.toContain("raw-telegram-token");
    expect(setupJson).not.toContain("raw-openai-key");
  });

  it("discovers Telegram chat IDs from getUpdates without returning the token", async () => {
    const chats = await discoverTelegramChatIds({
      botToken: "123456:raw-telegram-token",
      apiBaseUrl: "https://telegram.test",
      fetchImpl: async (url) => {
        expect(String(url)).toContain("123456:raw-telegram-token");
        return Response.json({
          ok: true,
          result: [
            { message: { chat: { id: -100123, type: "supergroup", title: "Forge Ops" } } },
            { channel_post: { chat: { id: -100456, type: "channel", title: "Deploys" } } },
            { message: { chat: { id: -100123, type: "supergroup", title: "Forge Ops" } } }
          ]
        });
      }
    });

    expect(chats).toEqual([
      { chatId: "-100123", type: "supergroup", title: "Forge Ops" },
      { chatId: "-100456", type: "channel", title: "Deploys" }
    ]);
    expect(JSON.stringify(chats)).not.toContain("raw-telegram-token");
  });
});
