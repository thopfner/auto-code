import type { OpenClawSetup, SecretRef } from "../../core/src/index.js";
import type { SecretResolver } from "./secrets.js";

export interface OpenClawHealth {
  ok: boolean;
  endpoint: string;
  version?: string;
}

export interface OpenClawSetupAdapter {
  checkHealth(setup: OpenClawSetup): Promise<OpenClawHealth>;
  sendTelegramStatus(setup: OpenClawSetup, chatId: string, text: string): Promise<void>;
}

export class HttpOpenClawGatewayAdapter implements OpenClawSetupAdapter {
  constructor(private readonly secrets: SecretResolver) {}

  async checkHealth(setup: OpenClawSetup): Promise<OpenClawHealth> {
    const token = await this.resolveToken(setup.tokenRef);
    const healthPaths = ["/health", "/api/health", "/status"];
    const failures: string[] = [];

    for (const path of healthPaths) {
      const endpoint = new URL(path, setup.baseUrl);
      try {
        const response = await fetch(endpoint, {
          headers: this.authHeaders(token),
          signal: AbortSignal.timeout(5_000)
        });
        if (response.ok) {
          const payload = (await response.json().catch(() => undefined)) as { version?: string } | undefined;
          return { ok: true, endpoint: endpoint.toString(), version: payload?.version };
        }
        failures.push(`${path}: HTTP ${response.status}`);
      } catch (error) {
        failures.push(`${path}: ${error instanceof Error ? error.message : "request failed"}`);
      }
    }

    throw new Error(`OpenClaw health check failed (${failures.join("; ")})`);
  }

  async sendTelegramStatus(setup: OpenClawSetup, chatId: string, text: string): Promise<void> {
    const token = await this.resolveToken(setup.tokenRef);
    const endpoint = new URL(setup.agentHookPath, setup.baseUrl);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...this.authHeaders(token),
        "content-type": "application/json"
      },
      body: JSON.stringify({
        message: text,
        name: "Auto Forge Controller setup smoke",
        deliver: "announce",
        channel: "telegram",
        to: chatId
      }),
      signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`OpenClaw Telegram delivery failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
  }

  private async resolveToken(tokenRef: SecretRef): Promise<string> {
    const token = await this.secrets.resolve(tokenRef);
    if (!token) {
      throw new Error(`Unable to resolve OpenClaw token from ${tokenRef}`);
    }
    return token;
  }

  private authHeaders(token: string): Record<string, string> {
    return { authorization: `Bearer ${token}`, "x-openclaw-token": token };
  }
}
