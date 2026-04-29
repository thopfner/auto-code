import { describe, expect, it } from "vitest";
import { FakeOpenClawSetupAdapter, FakeTelegramSetupAdapter, OpenClawCliMessageAdapter } from "../packages/adapters/src/index.js";
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

  it("sends OpenClaw routed Telegram delivery through the CLI message command", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const adapter = new OpenClawCliMessageAdapter({
      execFileImpl: ((
        command: string,
        args: string[],
        ...rest: unknown[]
      ) => {
        calls.push({ command, args });
        const callback = rest.at(-1) as (error: Error | null, stdout: string, stderr: string) => void;
        callback(null, JSON.stringify({ ok: true }), "");
      }) as never
    });

    const health = await adapter.checkHealth(openClawSetup);
    await adapter.sendTelegramStatus(openClawSetup, "7375937847", "ready");

    expect(health.ok).toBe(true);
    expect(calls).toEqual([
      { command: "openclaw", args: ["gateway", "status", "--json", "--require-rpc"] },
      {
        command: "openclaw",
        args: ["message", "send", "--channel", "telegram", "--target", "7375937847", "--message", "ready", "--json"]
      }
    ]);
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
