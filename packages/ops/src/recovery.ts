import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ForgeTask, WorkflowStore } from "../../core/src/index.js";
import { resolveOpsPaths, type OpsPaths } from "./paths.js";

export type RecoveryAction = "list-stuck" | "mark-blocked" | "cancel";
export type ServiceLogName = "api" | "worker" | "web" | "postgres";

export interface ServiceLogSource {
  kind: "local-npm" | "docker-compose" | "systemd";
  status: "available" | "not-created" | "command";
  path?: string;
  command?: string;
  message: string;
}

export interface ServiceLogDiscovery {
  service: ServiceLogName;
  sources: ServiceLogSource[];
}

export interface RecoveryFinding {
  taskId: string;
  status: ForgeTask["status"];
  title: string;
  updatedAt: string;
  reason: string;
}

export interface RecoveryOptions {
  staleMinutes?: number;
  now?: Date;
}

export async function findStuckTasks(store: WorkflowStore, options: RecoveryOptions = {}): Promise<RecoveryFinding[]> {
  const staleMs = (options.staleMinutes ?? 60) * 60_000;
  const now = options.now ?? new Date();
  const activeStatuses = new Set<ForgeTask["status"]>([
    "scope_running",
    "planning",
    "waiting_approval",
    "worker_running",
    "qa_running"
  ]);
  const tasks = await store.listTasks();

  return tasks
    .filter((task) => activeStatuses.has(task.status))
    .filter((task) => now.getTime() - task.updatedAt.getTime() >= staleMs)
    .map((task) => ({
      taskId: task.id,
      status: task.status,
      title: task.title,
      updatedAt: task.updatedAt.toISOString(),
      reason: `No state transition for at least ${options.staleMinutes ?? 60} minutes`
    }));
}

export async function appendRecoveryLog(
  finding: RecoveryFinding,
  action: RecoveryAction,
  options: { paths?: OpsPaths; cwd?: string; env?: NodeJS.ProcessEnv; dryRun?: boolean } = {}
): Promise<string> {
  const paths = options.paths ?? resolveOpsPaths(options.env, options.cwd);
  const taskLogDir = join(paths.logDir, "tasks", finding.taskId);
  const logPath = join(taskLogDir, "recovery.jsonl");
  const entry = {
    at: new Date().toISOString(),
    action,
    dryRun: Boolean(options.dryRun),
    finding
  };

  if (!options.dryRun) {
    await mkdir(taskLogDir, { recursive: true });
    let previous = "";
    try {
      previous = await readFile(logPath, "utf8");
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }
    await writeFile(logPath, `${previous}${JSON.stringify(entry)}\n`, { mode: 0o600 });
  }

  return logPath;
}

export async function listTaskLogs(
  taskId: string,
  options: { paths?: OpsPaths; cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<string[]> {
  const paths = options.paths ?? resolveOpsPaths(options.env, options.cwd);
  const taskLogDir = join(paths.logDir, "tasks", taskId);
  try {
    return (await readdir(taskLogDir)).map((name) => join(taskLogDir, name)).sort();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function discoverServiceLogs(
  service: ServiceLogName,
  options: { paths?: OpsPaths; cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<ServiceLogDiscovery> {
  const paths = options.paths ?? resolveOpsPaths(options.env, options.cwd);
  const localServiceLogDir = join(paths.logDir, "services", service);
  const localSource = await localServiceLogSource(service, localServiceLogDir);
  const sources: ServiceLogSource[] = [
    localSource,
    {
      kind: "docker-compose",
      status: "command",
      command: `docker compose logs ${service}`,
      message: `Inspect Docker Compose logs for the ${service} service`
    }
  ];

  const systemdUnit = systemdUnitFor(service);
  if (systemdUnit) {
    sources.push({
      kind: "systemd",
      status: "command",
      command: `journalctl -u ${systemdUnit}`,
      message: `Inspect systemd journal logs for ${systemdUnit}`
    });
  }

  return { service, sources };
}

export function parseServiceLogName(service: string): ServiceLogName {
  if (service === "api" || service === "worker" || service === "web" || service === "postgres") {
    return service;
  }
  throw new Error(`Unsupported service log target: ${service}`);
}

async function localServiceLogSource(service: ServiceLogName, path: string): Promise<ServiceLogSource> {
  try {
    const entries = await readdir(path);
    return {
      kind: "local-npm",
      status: "available",
      path,
      message: `Local npm service log directory contains ${entries.length} entr${entries.length === 1 ? "y" : "ies"}`
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {
        kind: "local-npm",
        status: "not-created",
        path,
        message: `Local npm service log directory has not been created for ${service}`
      };
    }
    throw error;
  }
}

function systemdUnitFor(service: ServiceLogName): string | undefined {
  if (service === "api") {
    return "auto-forge-api";
  }
  if (service === "worker") {
    return "auto-forge-worker";
  }
  return undefined;
}
