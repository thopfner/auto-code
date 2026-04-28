import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { OpenClawSetupMode, SecretRef } from "../../core/src/index.js";

export interface OpenClawGatewayDiscovery {
  ok: boolean;
  mode: OpenClawSetupMode;
  baseUrl?: string;
  authRef?: SecretRef;
  agentHookPath?: string;
  source: "openclaw-cli" | "manual" | "deferred";
  status: "detected" | "missing-cli" | "not-running" | "configure-later" | "advanced-webhook";
  command?: string;
  message: string;
  nextStep?: string;
}

export interface OpenClawGatewayDiscoveryOptions {
  mode: OpenClawSetupMode;
  explicitBaseUrl?: string;
  explicitAuthRef?: SecretRef;
  agentHookPath?: string;
  env?: NodeJS.ProcessEnv;
  dryRun?: boolean;
  execFileImpl?: typeof execFile;
}

export async function discoverOpenClawGateway(options: OpenClawGatewayDiscoveryOptions): Promise<OpenClawGatewayDiscovery> {
  const agentHookPath = options.agentHookPath ?? "/hooks/agent";

  if (options.mode === "configure-later") {
    return {
      ok: false,
      mode: options.mode,
      baseUrl: options.explicitBaseUrl,
      agentHookPath,
      source: "deferred",
      status: "configure-later",
      message: "OpenClaw setup deferred by operator choice.",
      nextStep: "Run npm run setup:vps again with --openclaw-mode detect-existing after OpenClaw gateway onboarding is complete."
    };
  }

  if (options.mode === "advanced-webhook") {
    if (!options.explicitBaseUrl) {
      throw new Error("advanced OpenClaw webhook mode requires --openclaw-base-url <url>");
    }
    if (!options.explicitAuthRef) {
      throw new Error("advanced OpenClaw webhook mode requires --openclaw-auth-ref <env:NAME|secret:name>");
    }
    return {
      ok: true,
      mode: options.mode,
      baseUrl: options.explicitBaseUrl,
      authRef: options.explicitAuthRef,
      agentHookPath,
      source: "manual",
      status: "advanced-webhook",
      message: "Using operator-provided advanced OpenClaw webhook reference."
    };
  }

  const cliDiscovery = await discoverWithOpenClawCli(options.execFileImpl ?? execFile, options.env ?? process.env);
  if (cliDiscovery.ok) {
    return {
      ...cliDiscovery,
      mode: options.mode,
      baseUrl: options.explicitBaseUrl ?? cliDiscovery.baseUrl,
      authRef: options.explicitAuthRef ?? cliDiscovery.authRef,
      agentHookPath: options.agentHookPath ?? cliDiscovery.agentHookPath ?? agentHookPath
    };
  }

  if (options.mode === "install-or-onboard") {
    return {
      ...cliDiscovery,
      mode: options.mode,
      nextStep:
        cliDiscovery.status === "missing-cli"
          ? "Install OpenClaw, run its onboarding, then rerun npm run setup:vps -- --openclaw-mode detect-existing."
          : "Run openclaw gateway start or OpenClaw onboarding, then rerun npm run setup:vps -- --openclaw-mode detect-existing."
    };
  }

  if (options.explicitBaseUrl) {
    return {
      ok: true,
      mode: options.mode,
      baseUrl: options.explicitBaseUrl,
      authRef: options.explicitAuthRef,
      agentHookPath,
      source: "manual",
      status: "detected",
      message: "Using explicit OpenClaw gateway URL while CLI discovery is unavailable.",
      nextStep: cliDiscovery.nextStep
    };
  }

  return cliDiscovery;
}

async function discoverWithOpenClawCli(
  execFileImpl: typeof execFile,
  env: NodeJS.ProcessEnv
): Promise<OpenClawGatewayDiscovery> {
  const command = env.OPENCLAW_CLI_COMMAND ?? "openclaw";
  const args = ["gateway", "status", "--json", "--require-rpc"];
  const commandText = `${command} ${args.join(" ")}`;

  try {
    const result = await promisify(execFileImpl)(command, args, { env, timeout: 10_000 });
    const stdout = typeof result === "string" ? result : (result as { stdout?: string }).stdout ?? "";
    const payload = parseGatewayStatus(stdout);
    const baseUrl = firstString(payload, ["baseUrl", "base_url", "gatewayUrl", "gateway_url", "url", "httpUrl", "http_url", "rpcUrl", "rpc_url"]);
    if (!baseUrl) {
      return {
        ok: false,
        mode: "detect-existing",
        source: "openclaw-cli",
        status: "not-running",
        command: commandText,
        message: "OpenClaw CLI did not report a gateway URL.",
        nextStep: "Run OpenClaw gateway onboarding, then rerun npm run setup:vps."
      };
    }

    return {
      ok: true,
      mode: "detect-existing",
      baseUrl: normalizeBaseUrl(baseUrl),
      authRef: firstString(payload, ["authRef", "auth_ref", "tokenRef", "token_ref"]) as SecretRef | undefined,
      agentHookPath: firstString(payload, ["agentHookPath", "agent_hook_path", "hookPath", "hook_path"]),
      source: "openclaw-cli",
      status: "detected",
      command: commandText,
      message: "Detected OpenClaw gateway through the OpenClaw CLI."
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenClaw gateway discovery failed";
    if (message.includes("ENOENT")) {
      return {
        ok: false,
        mode: "detect-existing",
        source: "openclaw-cli",
        status: "missing-cli",
        command: commandText,
        message: "OpenClaw CLI is not installed or not on PATH.",
        nextStep: "Install OpenClaw and complete gateway onboarding, then rerun npm run setup:vps."
      };
    }

    return {
      ok: false,
      mode: "detect-existing",
      source: "openclaw-cli",
      status: "not-running",
      command: commandText,
      message: `OpenClaw gateway is not discoverable: ${message}`,
      nextStep: "Start OpenClaw gateway or rerun OpenClaw onboarding, then rerun npm run setup:vps."
    };
  }
}

function parseGatewayStatus(stdout: string): Record<string, unknown> {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return {};
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object") {
    return {};
  }
  return parsed as Record<string, unknown>;
}

function firstString(payload: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function normalizeBaseUrl(value: string): string {
  const withScheme = /^https?:\/\//i.test(value) ? value : `http://${value}`;
  return withScheme.replace(/\/+$/, "");
}
