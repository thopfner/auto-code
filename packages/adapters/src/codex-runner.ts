import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, chmod, copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { ForgeRunner, RunnerRequest, RunnerResult } from "../../core/src/index.js";
import { resolveCodexCliCommand } from "./codex-binary.js";
import type { SecretResolver } from "./secrets.js";

const oauthAuthRef = "secret:codex-oauth-local-cache";
const oauthSourceFiles = ["auth.json", "config.toml"];

export interface CodexCliRunnerOptions {
  codexBin?: string;
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  approvalPolicy?: "untrusted" | "on-request" | "never";
  extraArgs?: string[];
}

export class CodexCliRunner implements ForgeRunner {
  constructor(
    private readonly secrets: SecretResolver,
    private readonly options: CodexCliRunnerOptions = {}
  ) {}

  async run(request: RunnerRequest): Promise<RunnerResult> {
    const attempt = request.attempt ?? 1;
    const logPath = join(request.artifactDir, `${request.role}-${attempt}.jsonl`);
    await mkdir(dirname(logPath), { recursive: true });
    const prompt = await readFile(request.promptPath, "utf8");
    const resolvedCodex = await this.resolveCodexForRun(logPath, request.role);
    if ("status" in resolvedCodex) {
      return resolvedCodex;
    }

    const args = [
      "exec",
      "--json",
      "--color",
      "never",
      "--ephemeral",
      "--sandbox",
      this.options.sandbox ?? "workspace-write",
      "--config",
      `approval_policy="${this.options.approvalPolicy ?? "never"}"`,
      "--output-last-message",
      join(request.artifactDir, `${request.role}-${attempt}-last-message.md`)
    ];
    if (request.repoPath) {
      args.push("--cd", request.repoPath, "--skip-git-repo-check");
    }
    if (request.profile.model) {
      args.push("--model", request.profile.model);
    }
    args.push(...(this.options.extraArgs ?? []), "-");

    const env = { ...process.env };
    const runtimeReady = await prepareCodexRuntime({
      env,
      codexAuthRef: request.profile.codexAuthRef,
      logPath
    });
    if (!runtimeReady.ok) {
      return {
        runId: `codex-${request.role}-${Date.now()}`,
        status: "failed",
        exitCode: 1,
        logPath,
        artifacts: [logPath],
        blockerReason: runtimeReady.blockerReason
      };
    }

    const auth = await this.resolveAuth(request.profile.codexAuthRef);
    if (auth) {
      env.OPENAI_API_KEY = auth;
    }

    const result = await runProcess(resolvedCodex.command, args, prompt, logPath, env);
    const blockerReason = result.exitCode === 0 ? undefined : summarizeCodexFailure(result.output, result.exitCode);
    return {
      runId: `codex-${request.role}-${Date.now()}`,
      status: result.exitCode === 0 ? "succeeded" : "failed",
      exitCode: result.exitCode,
      logPath,
      artifacts: [logPath],
      blockerReason
    };
  }

  async smoke(): Promise<{ ok: boolean; version: string }> {
    const codexBin = (await resolveCodexCliCommand({ codexBin: this.options.codexBin })).command;
    const version = await runCapture(codexBin, ["--version"]);
    await runCapture(codexBin, ["exec", "--help"]);
    return { ok: true, version };
  }

  private async resolveCodexForRun(logPath: string, role: RunnerRequest["role"]): Promise<{ command: string } | RunnerResult> {
    try {
      return await resolveCodexCliCommand({ codexBin: this.options.codexBin });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Codex CLI is unavailable";
      await writeFile(logPath, `${message}\n`);
      return {
        runId: `codex-${role}-${Date.now()}`,
        status: "failed",
        exitCode: 127,
        logPath,
        artifacts: [logPath],
        blockerReason: message
      };
    }
  }

  private async resolveAuth(ref: RunnerRequest["profile"]["codexAuthRef"]): Promise<string | undefined> {
    if (!ref.startsWith("env:")) {
      return undefined;
    }
    return this.secrets.resolve(ref);
  }
}

async function runProcess(
  command: string,
  args: string[],
  stdin: string,
  logPath: string,
  env: NodeJS.ProcessEnv
): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env, stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let settled = false;
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", async (error) => {
      settled = true;
      const message =
        error && typeof error === "object" && "code" in error && error.code === "ENOENT"
          ? `Auto Forge could not start Codex CLI (${command}). Run scripts/bootstrap.sh on the host or rebuild the Docker image so npm ci installs @openai/codex.`
          : error instanceof Error
            ? error.message
            : "Codex CLI process failed to start";
      await mkdir(dirname(logPath), { recursive: true });
      await writeFile(logPath, `${message}\n`);
      resolve({ exitCode: 127, output: message });
    });
    child.on("close", async (code) => {
      if (settled) {
        return;
      }
      settled = true;
      await mkdir(dirname(logPath), { recursive: true });
      const output = Buffer.concat(chunks).toString("utf8");
      await import("node:fs/promises").then((fs) => fs.writeFile(logPath, output));
      resolve({ exitCode: code ?? 1, output });
    });
    child.stdin.end(stdin);
  });
}

async function prepareCodexRuntime(options: {
  env: NodeJS.ProcessEnv;
  codexAuthRef: RunnerRequest["profile"]["codexAuthRef"];
  logPath: string;
}): Promise<{ ok: true } | { ok: false; blockerReason: string }> {
  try {
    const codexHome = options.env.CODEX_HOME?.trim();
    if (codexHome) {
      await mkdir(codexHome, { recursive: true, mode: 0o700 });
      await chmod(codexHome, 0o700);
      await access(codexHome, constants.W_OK);
    }

    if (options.codexAuthRef !== oauthAuthRef) {
      return { ok: true };
    }

    if (!codexHome) {
      throw new Error("CODEX_HOME is required for OAuth-backed Codex runs.");
    }

    const authSource = (options.env.AUTO_FORGE_CODEX_AUTH_SOURCE_DIR ?? options.env.CODEX_AUTH_SOURCE_DIR ?? "/codex-auth-source").trim();
    if (!authSource) {
      throw new Error("AUTO_FORGE_CODEX_AUTH_SOURCE_DIR is required for OAuth-backed Codex runs.");
    }
    if (resolve(authSource) === resolve(codexHome)) {
      throw new Error("OAuth auth source must be separate from active CODEX_HOME.");
    }

    if (!(await pathExists(authSource))) {
      throw new Error(`Codex OAuth auth source is missing at ${authSource}.`);
    }
    if (!(await pathExists(join(authSource, "auth.json")))) {
      throw new Error(`Codex OAuth auth source is missing auth.json at ${authSource}.`);
    }
    await access(authSource, constants.R_OK);
    await access(join(authSource, "auth.json"), constants.R_OK);
    await copyOAuthSourceFiles(authSource, codexHome);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Codex runtime preparation failed.";
    const blockerReason = summarizeCodexFailure(message, 1);
    await mkdir(dirname(options.logPath), { recursive: true });
    await writeFile(options.logPath, `${blockerReason}\n`);
    return { ok: false, blockerReason };
  }
}

async function copyOAuthSourceFiles(sourceDir: string, codexHome: string): Promise<void> {
  for (const file of oauthSourceFiles) {
    const sourcePath = join(sourceDir, file);
    const destPath = join(codexHome, file);
    if (!(await pathExists(sourcePath))) {
      continue;
    }
    if (await pathExists(destPath)) {
      continue;
    }

    const sourceStat = await stat(sourcePath);
    if (!sourceStat.isFile()) {
      continue;
    }
    await copyFile(sourcePath, destPath);
    await chmod(destPath, 0o600);
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function summarizeCodexFailure(output: string, exitCode: number): string {
  const redacted = redactSensitiveText(output);
  const compact = redacted
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-8)
    .join(" ");
  const lower = compact.toLowerCase();

  if (lower.includes("codex_home is required") || lower.includes("codex_home=/data/codex-home") || lower.includes("read-only file system") || lower.includes("readonly file system")) {
    return `Codex runtime home is not writable: read-only filesystem. Set CODEX_HOME=/data/codex-home, keep the OAuth source mounted separately read-only, and verify the /data mount is writable.`;
  }
  if (lower.includes("permission denied") || lower.includes("eacces")) {
    return `Codex runtime path is not writable: permission denied. Verify /data, CODEX_HOME, prompts, and artifact directories are writable by the container user.`;
  }
  if (
    lower.includes("auth source") ||
    lower.includes("auth.json") ||
    lower.includes("not authenticated") ||
    lower.includes("login") ||
    lower.includes("api key") ||
    lower.includes("openai_api_key")
  ) {
    return `Codex authentication is missing or expired. For OAuth, rerun device auth on the host auth-source cache; for API-key mode, verify OPENAI_API_KEY is present in the runtime env.`;
  }
  if (lower.includes("codex cli") || lower.includes("enoent") || lower.includes("no such file or directory")) {
    return `Codex CLI is unavailable in the runtime. Run scripts/bootstrap.sh on the host or rebuild the Docker image so @openai/codex is installed.`;
  }

  const detail = compact ? ` Last output: ${compact.slice(0, 500)}` : "";
  return `codex exec exited with ${exitCode}.${detail}`;
}

function redactSensitiveText(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_-]{16,}/g, "[REDACTED_OPENAI_KEY]")
    .replace(/\b\d{6,12}:[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_TELEGRAM_TOKEN]")
    .replace(/-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]*?-----END [^-]+ PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]")
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[REDACTED]"')
    .replace(/"refresh_token"\s*:\s*"[^"]+"/gi, '"refresh_token":"[REDACTED]"');
}

async function runCapture(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const output = Buffer.concat(chunks).toString("utf8").trim();
      if (code !== 0) {
        reject(new Error(output || `${command} ${args.join(" ")} exited with ${code}`));
        return;
      }
      resolve(output);
    });
  });
}
