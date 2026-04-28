import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CodexCliRunner, EnvSecretResolver, HttpOpenClawGatewayAdapter, TelegramBotApiAdapter } from "../packages/adapters/src/index.js";
import type { ControllerSetup, RunnerRequest } from "../packages/core/src/index.js";
import { validateSetup } from "../apps/api/src/server.js";

const execFileAsync = promisify(execFile);

const required = ["OPENCLAW_BASE_URL", "OPENCLAW_TOKEN", "TELEGRAM_BOT_TOKEN", "TELEGRAM_TEST_CHAT_ID", "OPENAI_API_KEY"];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        status: "BLOCKED_EXTERNAL",
        missing,
        requirements: [
          "OPENCLAW_BASE_URL must point at the staged or live OpenClaw gateway.",
          "OPENCLAW_TOKEN must authorize OpenClaw health and Telegram delivery.",
          "TELEGRAM_BOT_TOKEN must authorize getMe, setMyCommands, and sendMessage.",
          "TELEGRAM_TEST_CHAT_ID must identify the staged or live operator chat.",
          "OPENAI_API_KEY must authorize the Codex CLI runner smoke for CODEX_AUTH_REF=env:OPENAI_API_KEY."
        ]
      },
      null,
      2
    )
  );
  process.exit(2);
}

const setup: ControllerSetup = {
  configuredByUserId: "phase-5-live-smoke",
  updatedAt: new Date().toISOString(),
  openClaw: {
    baseUrl: process.env.OPENCLAW_BASE_URL ?? "",
    tokenRef: "env:OPENCLAW_TOKEN",
    agentHookPath: process.env.OPENCLAW_AGENT_HOOK_PATH ?? "/hooks/agent"
  },
  telegram: {
    botTokenRef: "env:TELEGRAM_BOT_TOKEN",
    testChatId: process.env.TELEGRAM_TEST_CHAT_ID ?? "",
    registerCommands: true,
    sendTestMessage: true,
    commands: ["scope", "status", "queue"]
  }
};

const secrets = new EnvSecretResolver();
const setupResult = await validateSetup(setup, {
  openClaw: new HttpOpenClawGatewayAdapter(secrets),
  telegram: new TelegramBotApiAdapter(secrets)
});

if (!setupResult.ok) {
  console.log(JSON.stringify({ ok: false, status: "BLOCKED_EXTERNAL", setupChecks: setupResult.checks }, null, 2));
  process.exit(2);
}

const codex = new CodexCliRunner(secrets, { sandbox: "read-only", approvalPolicy: "never" });
const codexVersion = await codex.smoke();
const codexRun = await runCodexSmoke(codex);

console.log(
  JSON.stringify(
    {
      ok: codexRun.status === "succeeded",
      status: codexRun.status === "succeeded" ? "PASSED" : "BLOCKED_EXTERNAL",
      setupChecks: setupResult.checks,
      codexVersion,
      codexRun: {
        status: codexRun.status,
        exitCode: codexRun.exitCode,
        logPath: codexRun.logPath
      }
    },
    null,
    2
  )
);

process.exitCode = codexRun.status === "succeeded" ? 0 : 2;

async function runCodexSmoke(codex: CodexCliRunner) {
  const root = await mkdtemp(join(tmpdir(), "auto-forge-live-codex-"));
  await execFileAsync("git", ["init", "-b", "main"], { cwd: root });
  await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  await execFileAsync("git", ["config", "user.name", "Auto Forge Smoke"], { cwd: root });
  await writeFile(join(root, "README.md"), "# Auto Forge Live Smoke\n");
  await execFileAsync("git", ["add", "README.md"], { cwd: root });
  await execFileAsync("git", ["commit", "-m", "Initial smoke fixture"], { cwd: root });

  const promptPath = join(root, "prompt.md");
  await writeFile(promptPath, "Reply with exactly AUTO_FORGE_E2E_SMOKE_OK and do not edit files.\n");

  const request: RunnerRequest = {
    taskId: "phase-5-live-smoke",
    repoId: "phase-5-live-smoke-repo",
    role: "qa",
    profile: {
      id: "phase-5-live-smoke-profile",
      name: "Phase 5 live smoke",
      role: "qa",
      codexAuthRef: "env:OPENAI_API_KEY",
      createdAt: new Date()
    },
    promptPath,
    artifactDir: join(root, "artifacts"),
    repoPath: root,
    attempt: 1
  };

  return codex.run(request);
}
