import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

export type CodexCliResolutionSource = "options" | "env" | "managed";

export interface CodexCliResolution {
  command: string;
  source: CodexCliResolutionSource;
}

export interface ResolveCodexCliOptions {
  codexBin?: string;
  env?: NodeJS.ProcessEnv;
}

export class CodexCliUnavailableError extends Error {
  constructor(
    message: string,
    readonly command: string,
    readonly source: CodexCliResolutionSource
  ) {
    super(message);
    this.name = "CodexCliUnavailableError";
  }
}

export function managedCodexCliPath(): string {
  return fileURLToPath(new URL("../../../node_modules/.bin/codex", import.meta.url));
}

export async function resolveCodexCliCommand(options: ResolveCodexCliOptions = {}): Promise<CodexCliResolution> {
  const env = options.env ?? process.env;
  const optionCommand = normalizeCommand(options.codexBin);
  if (optionCommand) {
    return resolveExplicitCommand(optionCommand, "options", env);
  }

  const envCommand = normalizeCommand(env.CODEX_CLI_COMMAND);
  if (envCommand) {
    return resolveExplicitCommand(envCommand, "env", env);
  }

  const managedCommand = managedCodexCliPath();
  if (await isExecutableCommand(managedCommand, env)) {
    return { command: managedCommand, source: "managed" };
  }

  throw new CodexCliUnavailableError(
    `Auto Forge could not find its repo-managed Codex CLI at ${managedCommand}. Run scripts/bootstrap.sh on the host or rebuild the Docker image so npm ci installs @openai/codex.`,
    managedCommand,
    "managed"
  );
}

async function resolveExplicitCommand(
  command: string,
  source: "options" | "env",
  env: NodeJS.ProcessEnv
): Promise<CodexCliResolution> {
  if (await isExecutableCommand(command, env)) {
    return { command, source };
  }

  const sourceLabel = source === "options" ? "CodexCliRunnerOptions.codexBin" : "CODEX_CLI_COMMAND";
  throw new CodexCliUnavailableError(
    `Configured Codex CLI command from ${sourceLabel} (${command}) is not executable. Set it to a valid binary, or unset it to use Auto Forge's repo-managed Codex CLI. For fresh installs, run scripts/bootstrap.sh on the host or rebuild the Docker image.`,
    command,
    source
  );
}

function normalizeCommand(command: string | undefined): string | undefined {
  const normalized = command?.trim();
  return normalized ? normalized : undefined;
}

async function isExecutableCommand(command: string, env: NodeJS.ProcessEnv): Promise<boolean> {
  if (command.includes("/") || command.includes("\\")) {
    return isExecutablePath(command);
  }

  const pathEntries = (env.PATH ?? "").split(delimiter).filter(Boolean);
  const extensions = process.platform === "win32" ? ["", ".cmd", ".exe", ".bat"] : [""];
  for (const entry of pathEntries) {
    for (const extension of extensions) {
      if (await isExecutablePath(join(entry, `${command}${extension}`))) {
        return true;
      }
    }
  }
  return false;
}

async function isExecutablePath(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
