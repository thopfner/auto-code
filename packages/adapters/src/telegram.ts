import type { TelegramCommandName } from "../../core/src/index.js";
import { telegramCommandCatalog, type SecretRef } from "../../core/src/index.js";
import type { SecretResolver } from "./secrets.js";

export interface TelegramIdentity {
  id: number;
  username?: string;
}

export interface TelegramSetupAdapter {
  getIdentity(botTokenRef: SecretRef): Promise<TelegramIdentity>;
  registerCommands(botTokenRef: SecretRef, commands: TelegramCommandName[]): Promise<void>;
  sendMessage(botTokenRef: SecretRef, chatId: string, text: string): Promise<void>;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

export class TelegramBotApiAdapter implements TelegramSetupAdapter {
  constructor(
    private readonly secrets: SecretResolver,
    private readonly apiBaseUrl = "https://api.telegram.org"
  ) {}

  async getIdentity(botTokenRef: SecretRef): Promise<TelegramIdentity> {
    return this.request<TelegramIdentity>(botTokenRef, "getMe", {});
  }

  async registerCommands(botTokenRef: SecretRef, commands: TelegramCommandName[]): Promise<void> {
    const commandPayload = commands.map((command) => {
      const metadata = telegramCommandCatalog.find((entry) => entry.command === command);
      if (!metadata) {
        throw new Error(`Unknown Telegram command: ${command}`);
      }
      return metadata;
    });

    await this.request<true>(botTokenRef, "setMyCommands", { commands: commandPayload });
  }

  async sendMessage(botTokenRef: SecretRef, chatId: string, text: string): Promise<void> {
    await this.request<{ message_id: number }>(botTokenRef, "sendMessage", {
      chat_id: chatId,
      text
    });
  }

  private async request<T>(botTokenRef: SecretRef, method: string, body: unknown): Promise<T> {
    const token = await this.secrets.resolve(botTokenRef);
    if (!token) {
      throw new Error(`Unable to resolve Telegram bot token from ${botTokenRef}`);
    }

    const response = await fetch(`${this.apiBaseUrl}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    const payload = (await response.json().catch(() => undefined)) as TelegramApiResponse<T> | undefined;
    if (!response.ok || !payload?.ok || payload.result === undefined) {
      throw new Error(payload?.description ?? `Telegram ${method} failed with HTTP ${response.status}`);
    }

    return payload.result;
  }
}
