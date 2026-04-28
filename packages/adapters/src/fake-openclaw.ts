import type {
  OpenClawSetup,
  OperatorGateway,
  OperatorMessage,
  SecretRef
} from "../../core/src/index.js";
import type { EntityId } from "../../core/src/types.js";
import type { TelegramCommandName } from "../../core/src/setup.js";
import type { OpenClawHealth, OpenClawSetupAdapter } from "./openclaw.js";
import type { TelegramIdentity, TelegramSetupAdapter } from "./telegram.js";

export class FakeOperatorGateway implements OperatorGateway {
  readonly statusMessages: OperatorMessage[] = [];
  readonly approvalRequests: Array<OperatorMessage & { approvalId: EntityId }> = [];

  async sendStatus(message: OperatorMessage): Promise<void> {
    this.statusMessages.push(message);
  }

  async sendApprovalRequest(message: OperatorMessage & { approvalId: EntityId }): Promise<void> {
    this.approvalRequests.push(message);
  }
}

export class FakeOpenClawSetupAdapter implements OpenClawSetupAdapter {
  readonly deliveredMessages: Array<{ setup: OpenClawSetup; chatId: string; text: string }> = [];

  constructor(private readonly mode: "ok" | "fail-health" | "fail-delivery" = "ok") {}

  async checkHealth(setup: OpenClawSetup): Promise<OpenClawHealth> {
    if (this.mode === "fail-health") {
      throw new Error("fake OpenClaw health failure");
    }

    return {
      ok: true,
      endpoint: new URL("/health", setup.baseUrl).toString(),
      version: "fake-openclaw"
    };
  }

  async sendTelegramStatus(setup: OpenClawSetup, chatId: string, text: string): Promise<void> {
    if (this.mode === "fail-delivery") {
      throw new Error("fake OpenClaw delivery failure");
    }

    this.deliveredMessages.push({ setup, chatId, text });
  }
}

export class FakeTelegramSetupAdapter implements TelegramSetupAdapter {
  readonly registeredCommands: TelegramCommandName[][] = [];
  readonly sentMessages: Array<{ chatId: string; text: string }> = [];

  constructor(private readonly mode: "ok" | "fail-identity" | "fail-commands" | "fail-message" = "ok") {}

  async getIdentity(_botTokenRef: SecretRef): Promise<TelegramIdentity> {
    void _botTokenRef;
    if (this.mode === "fail-identity") {
      throw new Error("fake Telegram identity failure");
    }

    return { id: 1001, username: "auto_forge_bot" };
  }

  async registerCommands(_botTokenRef: SecretRef, commands: TelegramCommandName[]): Promise<void> {
    if (this.mode === "fail-commands") {
      throw new Error("fake Telegram command registration failure");
    }

    this.registeredCommands.push(commands);
  }

  async sendMessage(_botTokenRef: SecretRef, chatId: string, text: string): Promise<void> {
    if (this.mode === "fail-message") {
      throw new Error("fake Telegram outbound failure");
    }

    this.sentMessages.push({ chatId, text });
  }
}
