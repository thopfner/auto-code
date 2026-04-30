import { access, chmod, readFile, writeFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { OpenClawSetupAdapter } from "../../adapters/src/index.js";
import { EnvSecretResolver, HttpOpenClawGatewayAdapter, resolveCodexCliCommand } from "../../adapters/src/index.js";
import type { ControllerSetup, WorkflowStore, WorkflowStoreReadiness } from "../../core/src/index.js";
import { fingerprintConnectionString, PostgresWorkflowStore } from "../../db/src/index.js";
import { resolveOpsPaths, type OpsPaths } from "./paths.js";

const execFileAsync = promisify(execFile);

export type HealthStatus = "passed" | "failed" | "degraded" | "skipped";

export interface HealthCheck {
  name: "api" | "web" | "worker" | "database" | "openclaw" | "codex" | "setup" | "logs";
  status: HealthStatus;
  message: string;
  details?: Record<string, unknown>;
}

export interface HealthReport {
  ok: boolean;
  service: "auto-forge-controller";
  checkedAt: string;
  checks: HealthCheck[];
}

export interface HealthOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  paths?: OpsPaths;
  liveExternal?: boolean;
  fetchImpl?: typeof fetch;
  openClaw?: OpenClawSetupAdapter;
  workflowStore?: WorkflowStore;
  databaseReadiness?: () => Promise<WorkflowStoreReadiness>;
  now?: Date;
}

export interface WorkerHeartbeat {
  service: "auto-forge-worker";
  pid: number;
  runner: string;
  workflowStore: {
    mode: "memory" | "postgres";
    databaseUrlConfigured: boolean;
    connectionFingerprint?: string;
  };
  checkedAt: string;
}

export async function collectHealth(options: HealthOptions = {}): Promise<HealthReport> {
  const env = options.env ?? process.env;
  const paths = options.paths ?? resolveOpsPaths(env, options.cwd);
  const now = options.now ?? new Date();
  const checks: HealthCheck[] = [];
  const setup = await readSetup(paths.setupPath);

  checks.push(await checkHttpService("api", resolveApiHealthUrl(env), "AUTO_FORGE_API_HEALTH_URL", options.fetchImpl));
  checks.push(await checkHttpService("web", resolveWebHealthUrl(env), "AUTO_FORGE_WEB_HEALTH_URL", options.fetchImpl));
  checks.push(await checkWorkflowStore(env, options.workflowStore, options.databaseReadiness));
  checks.push(await checkSetup(setup, paths.setupPath));
  checks.push(await checkWorker(paths.workerHealthPath, now));
  checks.push(await checkLogs(paths.logDir));
  checks.push(await checkCodex(env));
  checks.push(await checkOpenClaw(setup, options.liveExternal ?? false, options.openClaw));

  return {
    ok: checks.every((check) => check.status !== "failed"),
    service: "auto-forge-controller",
    checkedAt: now.toISOString(),
    checks
  };
}

async function checkHttpService(
  name: "api" | "web",
  url: string | undefined,
  envName: string,
  fetchImpl: typeof fetch = fetch
): Promise<HealthCheck> {
  if (!url) {
    return {
      name,
      status: "skipped",
      message: `${name.toUpperCase()} reachability skipped; configure ${envName} to enable this check`
    };
  }

  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(5_000) });
    return {
      name,
      status: response.ok ? "passed" : "degraded",
      message: `${name.toUpperCase()} ${response.ok ? "reachable" : "returned non-OK status"} at ${url}`,
      details: { url, statusCode: response.status }
    };
  } catch (error) {
    return {
      name,
      status: "degraded",
      message: `${name.toUpperCase()} is not reachable at ${url}`,
      details: { url, error: error instanceof Error ? error.message : "unknown error" }
    };
  }
}

function resolveApiHealthUrl(env: NodeJS.ProcessEnv): string | undefined {
  if (env.AUTO_FORGE_API_HEALTH_URL) {
    return env.AUTO_FORGE_API_HEALTH_URL;
  }
  if (!env.AUTO_FORGE_PUBLIC_BASE_URL) {
    return undefined;
  }
  return new URL("/live", env.AUTO_FORGE_PUBLIC_BASE_URL).toString();
}

function resolveWebHealthUrl(env: NodeJS.ProcessEnv): string | undefined {
  return env.AUTO_FORGE_WEB_HEALTH_URL ?? env.AUTO_FORGE_WEB_BASE_URL;
}

export async function writeWorkerHeartbeat(
  path = resolveOpsPaths().workerHealthPath,
  now = new Date(),
  env: NodeJS.ProcessEnv = process.env
): Promise<WorkerHeartbeat> {
  const heartbeat: WorkerHeartbeat = {
    service: "auto-forge-worker",
    pid: process.pid,
    runner: "codex-cli",
    workflowStore: describeWorkflowStoreFromEnv(env),
    checkedAt: now.toISOString()
  };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(heartbeat, null, 2)}\n`, { mode: 0o644 });
  await chmod(path, 0o644);
  return heartbeat;
}

async function checkWorkflowStore(
  env: NodeJS.ProcessEnv,
  workflowStore?: WorkflowStore,
  databaseReadiness?: () => Promise<WorkflowStoreReadiness>
): Promise<HealthCheck> {
  const readiness = await resolveWorkflowStoreReadiness(env, workflowStore, databaseReadiness);
  if (!readiness.ready) {
    return {
      name: "database",
      status: "failed",
      message: readiness.message,
      details: readiness.details
    };
  }

  return {
    name: "database",
    status: "passed",
    message: readiness.message,
    details: {
      ...readiness.details,
      mode: readiness.mode
    }
  };
}

async function resolveWorkflowStoreReadiness(
  env: NodeJS.ProcessEnv,
  workflowStore?: WorkflowStore,
  databaseReadiness?: () => Promise<WorkflowStoreReadiness>
): Promise<WorkflowStoreReadiness> {
  if (workflowStore) {
    return workflowStore.checkReadiness();
  }
  if (databaseReadiness) {
    return databaseReadiness();
  }
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return {
      mode: "memory",
      ready: true,
      message: "DATABASE_URL is not configured; in-memory workflow store is active"
    };
  }
  try {
    new URL(databaseUrl);
  } catch {
    return {
      mode: "postgres",
      ready: false,
      message: "DATABASE_URL is not a valid URL"
    };
  }

  const store = new PostgresWorkflowStore({ connectionString: databaseUrl });
  try {
    return await store.checkReadiness();
  } finally {
    await store.close();
  }
}

export function describeWorkflowStoreFromEnv(env: NodeJS.ProcessEnv): WorkerHeartbeat["workflowStore"] {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return {
      mode: "memory",
      databaseUrlConfigured: false
    };
  }
  return {
    mode: "postgres",
    databaseUrlConfigured: true,
    connectionFingerprint: fingerprintConnectionString(databaseUrl)
  };
}

async function checkSetup(setup: ControllerSetup | undefined, setupPath: string): Promise<HealthCheck> {
  if (!setup) {
    return {
      name: "setup",
      status: "degraded",
      message: `Onboarding setup has not been written at ${setupPath}`
    };
  }

  return {
    name: "setup",
    status: "passed",
    message: "Onboarding setup is present with secret references only",
    details: {
      updatedAt: setup.updatedAt,
      openClawBaseUrl: setup.openClaw.baseUrl,
      telegramCommands: setup.telegram.commands
    }
  };
}

async function checkWorker(path: string, now: Date): Promise<HealthCheck> {
  const heartbeat = await readJson<WorkerHeartbeat>(path);
  if (!heartbeat) {
    return {
      name: "worker",
      status: "degraded",
      message: `Worker heartbeat not found at ${path}`
    };
  }

  const ageMs = now.getTime() - new Date(heartbeat.checkedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs > 120_000) {
    return {
      name: "worker",
      status: "degraded",
      message: `Worker heartbeat is stale at ${heartbeat.checkedAt}`,
      details: { path }
    };
  }

  return {
    name: "worker",
    status: "passed",
    message: `Worker heartbeat is fresh from pid ${heartbeat.pid}`,
    details: { runner: heartbeat.runner, checkedAt: heartbeat.checkedAt, workflowStore: heartbeat.workflowStore }
  };
}

async function checkLogs(path: string): Promise<HealthCheck> {
  try {
    await access(path, constants.R_OK);
    return { name: "logs", status: "passed", message: `Log directory is readable at ${path}` };
  } catch {
    return { name: "logs", status: "skipped", message: `Log directory has not been created yet at ${path}` };
  }
}

async function checkCodex(env: NodeJS.ProcessEnv): Promise<HealthCheck> {
  try {
    const resolved = await resolveCodexCliCommand({ env });
    const { stdout, stderr } = await execFileAsync(resolved.command, ["--version"], { timeout: 5_000, env });
    return {
      name: "codex",
      status: "passed",
      message: `${resolved.command} ${stdout.trim() || stderr.trim() || "version detected"}`,
      details: { source: resolved.source }
    };
  } catch (error) {
    return {
      name: "codex",
      status: "failed",
      message: error instanceof Error ? error.message : "Codex CLI is not available or did not return a version",
      details: { error: error instanceof Error ? error.message : "unknown error" }
    };
  }
}

async function checkOpenClaw(
  setup: ControllerSetup | undefined,
  liveExternal: boolean,
  openClaw: OpenClawSetupAdapter = new HttpOpenClawGatewayAdapter(new EnvSecretResolver())
): Promise<HealthCheck> {
  if (!setup) {
    return { name: "openclaw", status: "skipped", message: "OpenClaw check skipped until onboarding setup exists" };
  }
  if (!liveExternal) {
    return {
      name: "openclaw",
      status: "skipped",
      message: "OpenClaw live check skipped; pass --live-external to CLI health or ?liveExternal=true to API health"
    };
  }

  try {
    const health = await openClaw.checkHealth(setup.openClaw);
    return {
      name: "openclaw",
      status: health.ok ? "passed" : "failed",
      message: `OpenClaw reachable at ${health.endpoint}${health.version ? ` (${health.version})` : ""}`
    };
  } catch (error) {
    return {
      name: "openclaw",
      status: "failed",
      message: error instanceof Error ? error.message : "OpenClaw health check failed"
    };
  }
}

async function readSetup(path: string): Promise<ControllerSetup | undefined> {
  return readJson<ControllerSetup>(path);
}

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}
