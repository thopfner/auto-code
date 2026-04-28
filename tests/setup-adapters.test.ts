import { describe, expect, it } from "vitest";
import { FakeOpenClawSetupAdapter, FakeTelegramSetupAdapter } from "../packages/adapters/src/index.js";
import type { OpenClawSetup } from "../packages/core/src/index.js";

const openClawSetup: OpenClawSetup = {
  baseUrl: "http://localhost:18789",
  tokenRef: "env:OPENCLAW_TOKEN",
  agentHookPath: "/hooks/agent"
};

describe("fake setup adapters", () => {
  it("records OpenClaw routed Telegram delivery", async () => {
    const adapter = new FakeOpenClawSetupAdapter();

    const health = await adapter.checkHealth(openClawSetup);
    await adapter.sendTelegramStatus(openClawSetup, "-1001234567890", "ready");

    expect(health.ok).toBe(true);
    expect(adapter.deliveredMessages).toEqual([{ setup: openClawSetup, chatId: "-1001234567890", text: "ready" }]);
  });

  it("records Telegram identity, commands, and outbound messages", async () => {
    const adapter = new FakeTelegramSetupAdapter();

    const identity = await adapter.getIdentity("env:TELEGRAM_BOT_TOKEN");
    await adapter.registerCommands("env:TELEGRAM_BOT_TOKEN", ["scope", "status"]);
    await adapter.sendMessage("env:TELEGRAM_BOT_TOKEN", "-1001234567890", "ready");

    expect(identity.username).toBe("auto_forge_bot");
    expect(adapter.registeredCommands).toEqual([["scope", "status"]]);
    expect(adapter.sentMessages).toEqual([{ chatId: "-1001234567890", text: "ready" }]);
  });

  it("can simulate setup failures", async () => {
    await expect(new FakeOpenClawSetupAdapter("fail-health").checkHealth(openClawSetup)).rejects.toThrow(
      "fake OpenClaw health failure"
    );
    await expect(new FakeTelegramSetupAdapter("fail-identity").getIdentity("env:TELEGRAM_BOT_TOKEN")).rejects.toThrow(
      "fake Telegram identity failure"
    );
  });
});
