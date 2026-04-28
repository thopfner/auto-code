import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  appendRecoveryLog,
  collectHealth,
  createBackup,
  discoverServiceLogs,
  listTaskLogs,
  parseServiceLogName,
  restoreBackup,
  runInstallDocumentationDryRun,
  type RecoveryFinding
} from "../../../packages/ops/src/index.js";

const [command = "help", ...args] = process.argv.slice(2);

try {
  if (command === "health") {
    const report = await collectHealth({ liveExternal: args.includes("--live-external") });
    printJson(report);
    process.exitCode = report.ok ? 0 : 1;
  } else if (command === "backup") {
    const dryRun = args.includes("--dry-run");
    const output = readOption(args, "--output");
    const result = await createBackup({ dryRun, output });
    printJson({ ok: true, dryRun, ...result });
  } else if (command === "restore") {
    const dryRun = args.includes("--dry-run");
    const input = readOption(args, "--input") ?? args[0];
    if (!input) {
      throw new Error("restore requires --input <backup.json>");
    }
    const result = await restoreBackup({ input, dryRun });
    printJson({ ok: true, ...result });
  } else if (command === "recover") {
    await runRecover(args);
  } else if (command === "logs") {
    await runLogs(args);
  } else if (command === "install-check") {
    const report = await runInstallDocumentationDryRun();
    printJson(report);
    process.exitCode = report.ok ? 0 : 1;
  } else {
    printHelp();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "auto-forge CLI failed");
  process.exitCode = 1;
}

async function runLogs(args: string[]): Promise<void> {
  const taskId = readOption(args, "--task");
  const service = readOption(args, "--service");

  if (taskId && service) {
    throw new Error("logs accepts either --task <task-id> or --service <service>, not both");
  }
  if (taskId) {
    printJson({ ok: true, taskId, logs: await listTaskLogs(taskId) });
    return;
  }
  if (service) {
    const serviceLogs = await discoverServiceLogs(parseServiceLogName(service));
    printJson({ ok: true, ...serviceLogs });
    return;
  }

  throw new Error("logs requires --task <task-id> or --service <service>");
}

async function runRecover(args: string[]): Promise<void> {
  const action = readOption(args, "--action") ?? "list-stuck";
  const taskId = readOption(args, "--task");
  const dryRun = args.includes("--dry-run");

  if (action !== "list-stuck" && action !== "mark-blocked" && action !== "cancel") {
    throw new Error(`Unsupported recovery action: ${action}`);
  }
  if (!taskId && action !== "list-stuck") {
    throw new Error(`recover --action ${action} requires --task <task-id>`);
  }

  const finding = await recoveryFindingFromTask(taskId ?? "manual-inspection", action);
  const logPath = await appendRecoveryLog(finding, action, { dryRun });
  printJson({
    ok: true,
    dryRun,
    action,
    finding,
    logPath,
    operatorNextStep:
      action === "list-stuck"
        ? "Inspect active workflow store or task artifacts, then rerun recover with --action mark-blocked or --action cancel."
        : "Review the recovery log and reconcile DB task state through the controller workflow store."
  });
}

async function recoveryFindingFromTask(taskId: string, action: string): Promise<RecoveryFinding> {
  const artifactPath = join(
    process.env.AUTO_FORGE_ACTIVE_BRIEF_PATH ?? "docs/exec-plans/active/2026-04-28-auto-forge-controller",
    "automation/state.json"
  );
  const state = await readJsonIfPresent<{ status?: string; authorized_phase?: string; updated_at?: string }>(artifactPath);
  return {
    taskId,
    status: "blocked",
    title: `Manual recovery ${action}`,
    updatedAt: state?.updated_at ?? new Date().toISOString(),
    reason: state
      ? `Brief automation state is ${state.status ?? "unknown"} for ${state.authorized_phase ?? "unknown phase"}`
      : "No durable task store is configured for CLI mutation yet; recovery entry records operator intent."
  };
}

async function readJsonIfPresent<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function printHelp(): void {
  console.log(`auto-forge <command>

Commands:
  health [--live-external]        Check API-adjacent runtime, setup, worker, logs, Codex, and OpenClaw
  backup [--dry-run] [--output]   Export references-only setup/config backup
  restore --input <file> [--dry-run]
                                  Restore a references-only setup backup
  install-check                   Dry-run the documented install surface
  recover --action <name> [--task <id>] [--dry-run]
                                  Record stuck-task recovery intent
  logs --task <id>                List task log files
  logs --service <name>           Discover service logs for api, worker, web, or postgres
`);
}
