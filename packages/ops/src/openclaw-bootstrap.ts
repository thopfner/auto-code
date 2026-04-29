import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, chmod, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const managedOpenClawMarker = "<!-- AUTO_FORGE_MANAGED_OPENCLAW_WORKSPACE v1 -->";
export const managedOpenClawWorkspaceFiles = ["AGENTS.md", "SOUL.md", "USER.md", "IDENTITY.md", "TOOLS.md", "HEARTBEAT.md"] as const;

export type ManagedOpenClawWorkspaceFile = (typeof managedOpenClawWorkspaceFiles)[number];

export interface ManagedOpenClawBootstrapResult {
  workspaceDir: string;
  templateDir: string;
  written: string[];
  unchanged: string[];
  backups: Array<{ original: string; backup: string }>;
  removedBootstrap?: string;
  commands: string[];
  validatedConfig: boolean;
  skippedCli: boolean;
}

export interface ManagedOpenClawBootstrapOptions {
  workspaceDir: string;
  templateDir?: string;
  openClawCommand?: string;
  configureCli?: boolean;
  allowMissingCli?: boolean;
  execFileImpl?: typeof execFile;
  now?: Date;
}

export async function bootstrapManagedOpenClawWorkspace(
  options: ManagedOpenClawBootstrapOptions
): Promise<ManagedOpenClawBootstrapResult> {
  const workspaceDir = resolve(options.workspaceDir);
  const templateDir = resolve(options.templateDir ?? defaultOpenClawTemplateDir());
  const timestamp = backupTimestamp(options.now ?? new Date());
  const result: ManagedOpenClawBootstrapResult = {
    workspaceDir,
    templateDir,
    written: [],
    unchanged: [],
    backups: [],
    commands: [],
    validatedConfig: false,
    skippedCli: false
  };

  await mkdir(workspaceDir, { recursive: true, mode: 0o700 });
  await chmod(workspaceDir, 0o700);

  for (const file of managedOpenClawWorkspaceFiles) {
    const sourcePath = join(templateDir, file);
    const targetPath = join(workspaceDir, file);
    const content = await readTemplate(sourcePath, file);
    const existing = await readTextIfPresent(targetPath);

    if (existing === content) {
      result.unchanged.push(file);
      await chmod(targetPath, 0o600);
      continue;
    }

    if (existing !== undefined && !existing.includes(managedOpenClawMarker)) {
      const backupPath = await nextBackupPath(targetPath, timestamp);
      await rename(targetPath, backupPath);
      result.backups.push({ original: file, backup: backupPath });
    }

    await writeFile(targetPath, content.endsWith("\n") ? content : `${content}\n`, { mode: 0o600 });
    await chmod(targetPath, 0o600);
    result.written.push(file);
  }

  const bootstrapPath = join(workspaceDir, "BOOTSTRAP.md");
  const existingBootstrap = await readTextIfPresent(bootstrapPath);
  if (existingBootstrap !== undefined) {
    if (!existingBootstrap.includes(managedOpenClawMarker)) {
      const backupPath = await nextBackupPath(bootstrapPath, timestamp);
      await rename(bootstrapPath, backupPath);
      result.backups.push({ original: "BOOTSTRAP.md", backup: backupPath });
    } else {
      await rm(bootstrapPath);
    }
    result.removedBootstrap = "BOOTSTRAP.md";
  }

  if (options.configureCli ?? true) {
    const openClawCommand = options.openClawCommand ?? process.env.OPENCLAW_CLI_COMMAND ?? "openclaw";
    await runOpenClawConfig(openClawCommand, workspaceDir, options, result);
  }

  return result;
}

export function defaultOpenClawTemplateDir(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../assets/openclaw-workspace");
}

async function runOpenClawConfig(
  openClawCommand: string,
  workspaceDir: string,
  options: ManagedOpenClawBootstrapOptions,
  result: ManagedOpenClawBootstrapResult
): Promise<void> {
  const execImpl = options.execFileImpl ?? execFile;
  const run = async (args: string[]): Promise<void> => {
    result.commands.push(`${openClawCommand} ${args.join(" ")}`);
    try {
      await promisify(execImpl)(openClawCommand, args, { timeout: 15_000 });
    } catch (error) {
      if (isMissingCommand(error) && options.allowMissingCli) {
        result.skippedCli = true;
        return;
      }
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`OpenClaw command failed: ${openClawCommand} ${args.join(" ")}: ${detail}`);
    }
  };

  await run(["config", "set", "gateway.mode", "local"]);
  if (result.skippedCli) {
    return;
  }
  await run(["config", "set", "gateway.port", "18789"]);
  await run(["config", "set", "agents.defaults.workspace", workspaceDir]);
  await run(["config", "validate"]);
  result.validatedConfig = true;
}

async function readTemplate(path: string, file: ManagedOpenClawWorkspaceFile): Promise<string> {
  const content = await readFile(path, "utf8");
  if (!content.includes(managedOpenClawMarker)) {
    throw new Error(`Managed OpenClaw template ${file} is missing the Auto Forge managed marker.`);
  }
  return content;
}

async function readTextIfPresent(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function nextBackupPath(path: string, timestamp: string): Promise<string> {
  const base = `${path}.auto-forge-backup-${timestamp}`;
  for (let index = 0; index < 100; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index}`;
    try {
      await access(candidate, constants.F_OK);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return candidate;
      }
      throw error;
    }
  }
  throw new Error(`Could not choose a backup path for ${path}`);
}

function backupTimestamp(now: Date): string {
  return now.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/[:.]/g, "-");
}

function isMissingCommand(error: unknown): boolean {
  return isNodeError(error) && error.code === "ENOENT";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export async function assertManagedOpenClawWorkspace(path: string): Promise<void> {
  const workspaceStat = await stat(path);
  if ((workspaceStat.mode & 0o777) !== 0o700) {
    throw new Error(`Managed OpenClaw workspace must be mode 0700: ${path}`);
  }

  for (const file of managedOpenClawWorkspaceFiles) {
    const fullPath = join(path, file);
    const content = await readFile(fullPath, "utf8");
    if (!content.includes(managedOpenClawMarker)) {
      throw new Error(`Managed OpenClaw workspace file is missing marker: ${file}`);
    }
  }

  const bootstrap = await readTextIfPresent(join(path, "BOOTSTRAP.md"));
  if (bootstrap !== undefined) {
    throw new Error("Managed OpenClaw workspace must not leave BOOTSTRAP.md active.");
  }
}
