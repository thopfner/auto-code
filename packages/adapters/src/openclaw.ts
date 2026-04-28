import type { OpenClawSetup } from "../../core/src/index.js";
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
    if (setup.mode === "configure-later") {
      throw new Error("OpenClaw setup is deferred; run npm run setup:vps with --openclaw-mode detect-existing after gateway onboarding.");
    }
    const token = await this.resolveToken(setup);
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
    if (setup.mode === "configure-later") {
      throw new Error("OpenClaw setup is deferred; routed Telegram delivery is unavailable until gateway onboarding is complete.");
    }
    const token = await this.resolveToken(setup);
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

  private async resolveToken(setup: OpenClawSetup): Promise<string | undefined> {
    const tokenRef = setup.authRef ?? setup.tokenRef;
    if (!tokenRef) {
      return undefined;
    }
    const token = await this.secrets.resolve(tokenRef);
    if (!token) {
      throw new Error(`Unable to resolve OpenClaw gateway auth from ${tokenRef}`);
    }
    return token;
  }

  private authHeaders(token: string | undefined): Record<string, string> {
    if (!token) {
      return {};
    }
    return { authorization: `Bearer ${token}`, "x-openclaw-token": token };
  }
}
