import type { SecretRef } from "./types.js";

export const telegramCommandCatalog = [
  { command: "scope", description: "Start a Forge scoping workflow" },
  { command: "status", description: "Show controller and task status" },
  { command: "queue", description: "Show queued Forge tasks" },
  { command: "pause", description: "Pause a repo queue" },
  { command: "resume", description: "Resume a repo queue" },
  { command: "cancel", description: "Request task cancellation" }
] as const;

export type TelegramCommandName = (typeof telegramCommandCatalog)[number]["command"];

export type OpenClawSetupMode = "detect-existing" | "install-or-onboard" | "configure-later" | "advanced-webhook";

export interface OpenClawSetup {
  baseUrl: string;
  mode?: OpenClawSetupMode;
  authRef?: SecretRef;
  tokenRef?: SecretRef;
  agentHookPath: string;
  discovery?: {
    source: "openclaw-cli" | "manual" | "deferred" | "legacy";
    status: "detected" | "missing-cli" | "not-running" | "configure-later" | "advanced-webhook" | "legacy";
    command?: string;
    message?: string;
  };
}

export interface TelegramSetup {
  botTokenRef: SecretRef;
  testChatId: string;
  registerCommands: boolean;
  sendTestMessage: boolean;
  commands: TelegramCommandName[];
}

export interface ControllerSetup {
  openClaw: OpenClawSetup;
  telegram: TelegramSetup;
  configuredByUserId: string;
  updatedAt: string;
}

export type SetupCheckStatus = "passed" | "failed" | "skipped";

export interface SetupCheckResult {
  name: "openclaw_health" | "telegram_identity" | "telegram_commands" | "telegram_outbound" | "openclaw_telegram_outbound";
  status: SetupCheckStatus;
  message: string;
}

export interface SetupValidationResult {
  ok: boolean;
  checks: SetupCheckResult[];
  sanitizedSetup: ControllerSetup;
}

export interface SetupStore {
  read(): Promise<ControllerSetup | undefined>;
  write(setup: ControllerSetup): Promise<void>;
}

export class MemorySetupStore implements SetupStore {
  #setup: ControllerSetup | undefined;

  async read(): Promise<ControllerSetup | undefined> {
    return this.#setup;
  }

  async write(setup: ControllerSetup): Promise<void> {
    this.#setup = setup;
  }
}
