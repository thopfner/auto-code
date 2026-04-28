import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ForgeTask, WorkflowStore } from "../../core/src/index.js";
import { resolveOpsPaths, type OpsPaths } from "./paths.js";

export type RecoveryAction = "list-stuck" | "mark-blocked" | "cancel";

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
