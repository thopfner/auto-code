import {
  telegramCommandCatalog,
  type OpenClawSetupMode,
  type SetupCheckResult,
  type TelegramCommandName
} from "../../../packages/core/src/index.js";

export type OnboardingStepId = "telegram" | "openclaw" | "validate" | "finish";

export const onboardingSteps: Array<{ id: OnboardingStepId; label: string }> = [
  { id: "telegram", label: "Telegram" },
  { id: "openclaw", label: "OpenClaw" },
  { id: "validate", label: "Validate" },
  { id: "finish", label: "Finish" }
];

export interface OnboardingForm {
  configuredByUserId: string;
  telegramBotTokenRef: string;
  telegramTestChatId: string;
  telegramRegisterCommands: boolean;
  telegramSendTestMessage: boolean;
  telegramCommands: TelegramCommandName[];
  openClawMode: OpenClawSetupMode;
  openClawBaseUrl: string;
  openClawAuthRef: string;
  openClawAgentHookPath: string;
}

export interface OnboardingValidation {
  ok: boolean;
  checks: SetupCheckResult[];
}

export const defaultOnboardingForm: OnboardingForm = {
  configuredByUserId: "onboarding",
  telegramBotTokenRef: "env:TELEGRAM_BOT_TOKEN",
  telegramTestChatId: "",
  telegramRegisterCommands: true,
  telegramSendTestMessage: true,
  telegramCommands: telegramCommandCatalog.map((command) => command.command),
  openClawMode: "detect-existing",
  openClawBaseUrl: "http://localhost:18789",
  openClawAuthRef: "",
  openClawAgentHookPath: "/hooks/agent"
};

export function buildSetupPayload(form: OnboardingForm) {
  return {
    configuredByUserId: form.configuredByUserId.trim(),
    openClaw: {
      baseUrl: form.openClawBaseUrl.trim(),
      mode: form.openClawMode,
      authRef: form.openClawAuthRef.trim() || undefined,
      agentHookPath: form.openClawAgentHookPath.trim()
    },
    telegram: {
      botTokenRef: form.telegramBotTokenRef.trim(),
      testChatId: form.telegramTestChatId.trim(),
      registerCommands: form.telegramRegisterCommands,
      sendTestMessage: form.telegramSendTestMessage,
      commands: form.telegramCommands
    }
  };
}

export function validateStep(form: OnboardingForm, step: OnboardingStepId): string[] {
  const errors: string[] = [];

  if (step === "telegram") {
    if (!isSecretRef(form.telegramBotTokenRef)) {
      errors.push("Telegram bot token must be an env: or secret: reference.");
    }
    if (!form.telegramTestChatId.trim()) {
      errors.push("Telegram test chat ID is required.");
    }
    if (form.telegramCommands.length === 0) {
      errors.push("At least one Telegram command must be selected.");
    }
  }

  if (step === "openclaw") {
    if (!isUrl(form.openClawBaseUrl)) {
      errors.push("OpenClaw gateway URL must be valid.");
    }
    if (form.openClawMode === "advanced-webhook" && !isSecretRef(form.openClawAuthRef)) {
      errors.push("Advanced OpenClaw webhook auth must be an env: or secret: reference.");
    }
    if (!/^\/[a-z0-9/_-]+$/i.test(form.openClawAgentHookPath)) {
      errors.push("OpenClaw hook path must start with / and contain only path characters.");
    }
  }

  return errors;
}

export function nextStep(current: OnboardingStepId): OnboardingStepId {
  const index = onboardingSteps.findIndex((step) => step.id === current);
  return onboardingSteps[Math.min(index + 1, onboardingSteps.length - 1)]?.id ?? "telegram";
}

export function previousStep(current: OnboardingStepId): OnboardingStepId {
  const index = onboardingSteps.findIndex((step) => step.id === current);
  return onboardingSteps[Math.max(index - 1, 0)]?.id ?? "telegram";
}

export function connectionSummary(validation: OnboardingValidation | undefined): Array<{ label: string; state: string }> {
  const checks = validation?.checks ?? [];
  return [
    { label: "OpenClaw", state: stateFor(checks, "openclaw_health") },
    { label: "Telegram identity", state: stateFor(checks, "telegram_identity") },
    { label: "Telegram commands", state: stateFor(checks, "telegram_commands") },
    { label: "Telegram outbound", state: stateFor(checks, "telegram_outbound") },
    { label: "OpenClaw delivery", state: stateFor(checks, "openclaw_telegram_outbound") }
  ];
}

function stateFor(checks: SetupCheckResult[], name: SetupCheckResult["name"]): string {
  return checks.find((check) => check.name === name)?.status ?? "pending";
}

function isSecretRef(value: string): boolean {
  return /^(env|secret):[A-Z0-9_./-]+$/i.test(value.trim());
}

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
