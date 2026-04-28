import { describe, expect, it } from "vitest";
import {
  buildSetupPayload,
  connectionSummary,
  defaultOnboardingForm,
  nextStep,
  previousStep,
  validateStep
} from "../apps/web/src/onboarding.js";

describe("web onboarding flow", () => {
  it("blocks Telegram progression until required connection inputs are valid", () => {
    const form = {
      ...defaultOnboardingForm,
      telegramBotTokenRef: "raw-token",
      telegramTestChatId: ""
    };

    expect(validateStep(form, "telegram")).toEqual([
      "Telegram bot token must be an env: or secret: reference.",
      "Telegram test chat ID is required."
    ]);
  });

  it("builds the setup API payload from trimmed onboarding inputs", () => {
    const payload = buildSetupPayload({
      ...defaultOnboardingForm,
      telegramTestChatId: " -1001234567890 ",
      openClawBaseUrl: " http://localhost:18789 ",
      openClawAgentHookPath: "/hooks/agent"
    });

    expect(payload).toMatchObject({
      openClaw: {
        baseUrl: "http://localhost:18789",
        tokenRef: "env:OPENCLAW_TOKEN"
      },
      telegram: {
        botTokenRef: "env:TELEGRAM_BOT_TOKEN",
        testChatId: "-1001234567890",
        registerCommands: true,
        sendTestMessage: true
      }
    });
  });

  it("advances and reverses through the guided setup steps", () => {
    expect(nextStep("telegram")).toBe("openclaw");
    expect(nextStep("openclaw")).toBe("validate");
    expect(nextStep("validate")).toBe("finish");
    expect(nextStep("finish")).toBe("finish");
    expect(previousStep("openclaw")).toBe("telegram");
  });

  it("summarizes validation checks for connection rows", () => {
    const summary = connectionSummary({
      ok: true,
      checks: [
        { name: "openclaw_health", status: "passed", message: "ok" },
        { name: "telegram_identity", status: "passed", message: "ok" },
        { name: "telegram_commands", status: "skipped", message: "disabled" },
        { name: "telegram_outbound", status: "passed", message: "ok" },
        { name: "openclaw_telegram_outbound", status: "passed", message: "ok" }
      ]
    });

    expect(summary).toContainEqual({ label: "Telegram commands", state: "skipped" });
    expect(summary).toContainEqual({ label: "OpenClaw delivery", state: "passed" });
  });
});
