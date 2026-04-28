import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ForgeRunner, RunnerRequest, RunnerResult } from "../../core/src/index.js";
import type { SecretResolver } from "./secrets.js";

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
    const codexBin = this.options.codexBin ?? "codex";
    const attempt = request.attempt ?? 1;
    const logPath = join(request.artifactDir, `${request.role}-${attempt}.jsonl`);
    await mkdir(dirname(logPath), { recursive: true });
    const prompt = await readFile(request.promptPath, "utf8");
    const args = [
      "exec",
      "--json",
      "--color",
      "never",
      "--sandbox",
      this.options.sandbox ?? "workspace-write",
      "--config",
      `approval_policy="${this.options.approvalPolicy ?? "never"}"`,
      "--output-last-message",
      join(request.artifactDir, `${request.role}-${attempt}-last-message.md`)
    ];
    if (request.repoPath) {
      args.push("--cd", request.repoPath);
    }
    if (request.profile.model) {
      args.push("--model", request.profile.model);
    }
    args.push(...(this.options.extraArgs ?? []), "-");

    const env = { ...process.env };
    const auth = await this.resolveAuth(request.profile.codexAuthRef);
    if (auth) {
      env.OPENAI_API_KEY = auth;
    }

    const result = await runProcess(codexBin, args, prompt, logPath, env);
    return {
      runId: `codex-${request.role}-${Date.now()}`,
      status: result.exitCode === 0 ? "succeeded" : "failed",
      exitCode: result.exitCode,
      logPath,
      artifacts: [logPath],
      blockerReason: result.exitCode === 0 ? undefined : `codex exec exited with ${result.exitCode}`
    };
  }

  async smoke(): Promise<{ ok: boolean; version: string }> {
    const codexBin = this.options.codexBin ?? "codex";
    const version = await runCapture(codexBin, ["--version"]);
    await runCapture(codexBin, ["exec", "--help"]);
    return { ok: true, version };
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
): Promise<{ exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", reject);
    child.on("close", async (code) => {
      await mkdir(dirname(logPath), { recursive: true });
      const output = Buffer.concat(chunks).toString("utf8");
      await import("node:fs/promises").then((fs) => fs.writeFile(logPath, output));
      resolve({ exitCode: code ?? 1 });
    });
    child.stdin.end(stdin);
  });
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
