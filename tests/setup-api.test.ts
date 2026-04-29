import { describe, expect, it } from "vitest";
import { buildServer, validateSetup } from "../apps/api/src/server.js";
import { FakeOpenClawSetupAdapter, FakeTelegramSetupAdapter } from "../packages/adapters/src/index.js";
import { MemorySetupStore, type ControllerSetup } from "../packages/core/src/index.js";

const setupPayload: ControllerSetup = {
  configuredByUserId: "user-1",
  updatedAt: "2026-04-29T00:00:00.000Z",
  openClaw: {
    baseUrl: "http://localhost:18789",
    tokenRef: "env:OPENCLAW_TOKEN",
    agentHookPath: "/hooks/agent"
  },
  telegram: {
    botTokenRef: "env:TELEGRAM_BOT_TOKEN",
    testChatId: "-1001234567890",
    registerCommands: true,
    sendTestMessage: true,
    commands: ["scope", "status", "queue"]
  }
};

describe("setup API", () => {
  it("validates OpenClaw and Telegram setup without storing raw secrets", async () => {
    const setupStore = new MemorySetupStore();
    const telegram = new FakeTelegramSetupAdapter();
    const openClaw = new FakeOpenClawSetupAdapter();
    const server = buildServer({ setupStore, telegram, openClaw });

    const response = await server.inject({
      method: "POST",
      url: "/setup",
      payload: setupPayload
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.ok).toBe(true);
    expect(body.sanitizedSetup.telegram.botTokenRef).toBe("env:TELEGRAM_BOT_TOKEN");
    expect(JSON.stringify(body)).not.toContain("123456:raw-token");
    expect(telegram.registeredCommands[0]).toEqual(["scope", "status", "queue"]);
    expect(openClaw.deliveredMessages).toHaveLength(1);

    const stored = await setupStore.read();
    expect(stored?.openClaw.tokenRef).toBe("env:OPENCLAW_TOKEN");
    expect(stored?.telegram.botTokenRef).toBe("env:TELEGRAM_BOT_TOKEN");
  });

  it("returns validation failures and does not save failed setup", async () => {
    const setupStore = new MemorySetupStore();
    const server = buildServer({
      setupStore,
      telegram: new FakeTelegramSetupAdapter("fail-message"),
      openClaw: new FakeOpenClawSetupAdapter()
    });

    const response = await server.inject({
      method: "POST",
      url: "/setup",
      payload: setupPayload
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().checks).toContainEqual(
      expect.objectContaining({ name: "telegram_outbound", status: "failed" })
    );
    expect(await setupStore.read()).toBeUndefined();
  });

  it("does not fail setup when only optional OpenClaw CLI Telegram delivery fails", async () => {
    const result = await validateSetup(setupPayload, {
      telegram: new FakeTelegramSetupAdapter(),
      openClaw: new FakeOpenClawSetupAdapter("fail-delivery")
    });

    expect(result.ok).toBe(true);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        name: "openclaw_telegram_outbound",
        status: "skipped",
        message: expect.stringContaining("Optional OpenClaw routed Telegram delivery did not pass")
      })
    );
  });

  it("can require OpenClaw CLI Telegram delivery for strict diagnostics", async () => {
    const result = await validateSetup(
      setupPayload,
      {
        telegram: new FakeTelegramSetupAdapter(),
        openClaw: new FakeOpenClawSetupAdapter("fail-delivery")
      },
      { requireOpenClawTelegramDelivery: true }
    );

    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ name: "openclaw_telegram_outbound", status: "failed" })
    );
  });

  it("documents the Telegram command set", async () => {
    const server = buildServer({
      setupStore: new MemorySetupStore(),
      telegram: new FakeTelegramSetupAdapter(),
      openClaw: new FakeOpenClawSetupAdapter()
    });

    const response = await server.inject({ method: "GET", url: "/setup/telegram-commands" });

    expect(response.statusCode).toBe(200);
    expect(response.json().commands).toContainEqual(
      expect.objectContaining({ command: "scope", description: "Start a Forge scoping workflow" })
    );
  });
});
