import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CodexCliRunner, EnvSecretResolver, OpenClawCliMessageAdapter, TelegramBotApiAdapter } from "../packages/adapters/src/index.js";
import type { ControllerSetup, RunnerRequest } from "../packages/core/src/index.js";
import { validateSetup } from "../apps/api/src/server.js";

const execFileAsync = promisify(execFile);

const openClawMode = process.env.OPENCLAW_SETUP_MODE ?? "detect-existing";
const openClawAuthRef = process.env.OPENCLAW_AUTH_REF ?? process.env.OPENCLAW_TOKEN_REF;
if (openClawMode === "configure-later") {
  console.log(
    JSON.stringify(
      {
        ok: false,
        status: "BLOCKED_EXTERNAL",
        openClawMode,
        requirements: ["OpenClaw is marked configure-later. Complete OpenClaw gateway onboarding, then rerun setup with OPENCLAW_SETUP_MODE=detect-existing."]
      },
      null,
      2
    )
  );
  process.exit(2);
}
const codexAuthRef = process.env.CODEX_AUTH_REF ?? "env:OPENAI_API_KEY";
const required = ["OPENCLAW_BASE_URL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_TEST_CHAT_ID"];
if (codexAuthRef === "env:OPENAI_API_KEY") {
  required.push("OPENAI_API_KEY");
}
const codexRequirement =
  codexAuthRef === "env:OPENAI_API_KEY"
    ? "OPENAI_API_KEY must authorize the Codex CLI runner smoke when CODEX_AUTH_REF=env:OPENAI_API_KEY."
    : "For CODEX_AUTH_REF=secret:codex-oauth-local-cache, run Codex OAuth device auth on the host and make CODEX_HOME point at that auth cache.";
if (openClawMode === "advanced-webhook" && !openClawAuthRef) {
  required.push("OPENCLAW_AUTH_REF");
}
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        status: "BLOCKED_EXTERNAL",
        openClawMode,
        missing,
        requirements: [
          "OPENCLAW_BASE_URL must point at the staged or live OpenClaw gateway.",
          "Default OpenClaw gateway mode uses gateway discovery/auth managed by OpenClaw; advanced webhook mode requires OPENCLAW_AUTH_REF.",
          "TELEGRAM_BOT_TOKEN must authorize getMe, setMyCommands, and sendMessage.",
          "TELEGRAM_TEST_CHAT_ID must identify the staged or live operator chat.",
          codexRequirement
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
    mode: openClawMode === "advanced-webhook" ? "advanced-webhook" : "detect-existing",
    authRef: openClawAuthRef as ControllerSetup["openClaw"]["authRef"],
    tokenRef: process.env.OPENCLAW_TOKEN_REF as ControllerSetup["openClaw"]["tokenRef"],
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
const requireOpenClawTelegramDelivery =
  process.env.AUTO_FORGE_REQUIRE_OPENCLAW_TELEGRAM_DELIVERY === "1" ||
  process.env.AUTO_FORGE_REQUIRE_OPENCLAW_TELEGRAM_DELIVERY === "true";
const setupResult = await validateSetup(
  setup,
  {
    openClaw: new OpenClawCliMessageAdapter({ env: process.env }),
    telegram: new TelegramBotApiAdapter(secrets)
  },
  { requireOpenClawTelegramDelivery }
);

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
      codexAuthRef: codexAuthRef as RunnerRequest["profile"]["codexAuthRef"],
      createdAt: new Date()
    },
    promptPath,
    artifactDir: join(root, "artifacts"),
    repoPath: root,
    attempt: 1
  };

  return codex.run(request);
}
