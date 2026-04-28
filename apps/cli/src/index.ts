import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  appendRecoveryLog,
  buildControllerSetup,
  buildVpsEnvValues,
  collectHealth,
  createBackup,
  discoverTelegramChatIds,
  discoverServiceLogs,
  generateNginxConfig,
  listTaskLogs,
  parseEnvFile,
  parseServiceLogName,
  restoreBackup,
  runInstallDocumentationDryRun,
  writeEnvBlock,
  type RecoveryFinding
} from "../../../packages/ops/src/index.js";
import {
  CodexCliRunner,
  EnvSecretResolver,
  FileSetupStore,
  HttpOpenClawGatewayAdapter,
  TelegramBotApiAdapter
} from "../../../packages/adapters/src/index.js";
import type { SecretRef } from "../../../packages/core/src/index.js";
import { validateSetup } from "../../api/src/server.js";

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
  } else if (command === "setup-vps") {
    await runSetupVps(args);
  } else {
    printHelp();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "auto-forge CLI failed");
  process.exitCode = 1;
}

async function runSetupVps(args: string[]): Promise<void> {
  if (args.includes("--non-interactive")) {
    await runSetupVpsNonInteractive(args);
    return;
  }

  const dryRun = args.includes("--dry-run");
  const envPath = resolve(readOption(args, "--runtime-env-file") ?? ".env");
  const setupPath = readOption(args, "--setup-path") ?? ".auto-forge/setup.json";
  const rl = createInterface({ input, output });

  try {
    await hydrateEnvFromFile(envPath);
    const publicBaseUrl = normalizePublicBaseUrl(
      await question(rl, "Controller public domain or base URL", process.env.AUTO_FORGE_PUBLIC_BASE_URL ?? "https://auto.example.com")
    );
    const serverName = new URL(publicBaseUrl).hostname;
    const apiPort = Number(await question(rl, "API upstream port", process.env.PORT ?? "3000"));
    const webPort = Number(await question(rl, "Web upstream port", "5173"));
    const configureNginx = await yesNo(rl, "Configure Nginx automatically when possible?", false);
    const openClawBaseUrl = normalizePublicBaseUrl(
      await question(rl, "OpenClaw gateway base URL", process.env.OPENCLAW_BASE_URL ?? "https://openclaw.example.com")
    );
    const openClawToken = await promptSecret(rl, "OpenClaw token", "OPENCLAW_TOKEN");
    const telegramBotToken = await promptSecret(rl, "Telegram bot token", "TELEGRAM_BOT_TOKEN");
    const telegramTestChatId = await promptTelegramChatId(rl, telegramBotToken);
    const codex = await promptCodexAuth(rl, dryRun);

    const nginxConfig = generateNginxConfig({ serverName, apiPort, webPort });
    const nginxPath = join(".auto-forge", "nginx", `${safeSiteName(serverName)}.conf`);
    const setup = buildControllerSetup({
      openClawBaseUrl,
      openClawToken,
      telegramBotToken,
      telegramTestChatId
    });
    const envValues = buildVpsEnvValues({
      publicBaseUrl,
      apiPort,
      webPort,
      openClawBaseUrl,
      openClawToken,
      telegramBotToken,
      telegramTestChatId,
      codexAuthRef: codex.codexAuthRef,
      codexApiKey: codex.codexApiKey,
      setupPath
    });

    console.log("\nOpenClaw settings");
    console.log(`Paste the controller command endpoint into OpenClaw if it cannot be set by API: ${new URL("/telegram/command", publicBaseUrl).toString()}`);
    console.log(`Use OpenClaw routed Telegram delivery with agent hook path: ${setup.openClaw.agentHookPath}`);
    if (new URL(publicBaseUrl).protocol !== "https:") {
      console.log("HTTPS is required before Telegram webhook production use. Install Certbot or use the VPS TLS manager before go-live.");
    }

    if (dryRun) {
      printJson({
        ok: true,
        dryRun: true,
        setupCommand: "npm run setup:vps",
        envFile: envPath,
        setupPath,
        nginxPath,
        nginxAutoConfigureRequested: configureNginx,
        setup,
        envKeys: Object.keys(envValues).sort(),
        nginxConfig
      });
      return;
    }

    await writeEnvBlock(envPath, envValues);
    Object.assign(process.env, envValues);
    await new FileSetupStore(setupPath).write(setup);
    await mkdir(join(".auto-forge", "nginx"), { recursive: true });
    await writeFile(nginxPath, nginxConfig, { mode: 0o644 });

    if (configureNginx) {
      await runCommand("bash", ["scripts/configure-nginx.sh", nginxPath, safeSiteName(serverName)]);
    } else {
      console.log(`Nginx config written to ${nginxPath}. Review it, then run: sudo bash scripts/configure-nginx.sh ${nginxPath} ${safeSiteName(serverName)}`);
    }

    const shouldValidate = await yesNo(rl, "Run live setup validation now?", true);
    if (shouldValidate) {
      const secrets = new EnvSecretResolver();
      const setupResult = await validateSetup(setup, {
        openClaw: new HttpOpenClawGatewayAdapter(secrets),
        telegram: new TelegramBotApiAdapter(secrets)
      });
      printJson({ ok: setupResult.ok, setupChecks: setupResult.checks });
      if (!setupResult.ok) {
        process.exitCode = 2;
        return;
      }

      const codexSmoke = await new CodexCliRunner(secrets, { sandbox: "read-only", approvalPolicy: "never" }).smoke();
      printJson({ ok: true, codexSmoke });
      if (codex.codexAuthRef === "env:OPENAI_API_KEY" && (await yesNo(rl, "Run npm run live:smoke now?", true))) {
        await runCommand("npm", ["run", "live:smoke"], { ...process.env, ...envValues });
      } else if (codex.codexAuthRef !== "env:OPENAI_API_KEY") {
        console.log("Skipped npm run live:smoke because it currently requires OPENAI_API_KEY for the final external gate.");
      }
    }

    printJson({
      ok: true,
      setupCommand: "npm run setup:vps",
      envFile: envPath,
      setupPath,
      nginxPath,
      secretPolicy: "setup JSON stores env/secret references only; raw values are limited to the ignored env file"
    });
  } finally {
    rl.close();
  }
}

async function runSetupVpsNonInteractive(args: string[]): Promise<void> {
  const dryRun = args.includes("--dry-run");
  const envPath = resolve(readOption(args, "--runtime-env-file") ?? ".env");
  const setupPath = readOption(args, "--setup-path") ?? ".auto-forge/setup.json";
  const publicBaseUrl = normalizePublicBaseUrl(readOption(args, "--public-base-url") ?? process.env.AUTO_FORGE_PUBLIC_BASE_URL ?? "https://auto.example.com");
  const openClawBaseUrl = normalizePublicBaseUrl(readOption(args, "--openclaw-base-url") ?? process.env.OPENCLAW_BASE_URL ?? "https://openclaw.example.com");
  const apiPort = Number(readOption(args, "--api-port") ?? process.env.PORT ?? "3000");
  const webPort = Number(readOption(args, "--web-port") ?? "5173");
  const serverName = new URL(publicBaseUrl).hostname;
  const openClawToken = {
    envName: envNameFromRef(readOption(args, "--openclaw-token-ref") ?? "env:OPENCLAW_TOKEN"),
    ref: (readOption(args, "--openclaw-token-ref") ?? "env:OPENCLAW_TOKEN") as SecretRef
  };
  const telegramBotToken = {
    envName: envNameFromRef(readOption(args, "--telegram-bot-token-ref") ?? "env:TELEGRAM_BOT_TOKEN"),
    ref: (readOption(args, "--telegram-bot-token-ref") ?? "env:TELEGRAM_BOT_TOKEN") as SecretRef
  };
  const telegramTestChatId = readOption(args, "--telegram-chat-id") ?? process.env.TELEGRAM_TEST_CHAT_ID ?? "-1001234567890";
  const codexAuthRef = (readOption(args, "--codex-auth-ref") ?? "env:OPENAI_API_KEY") as SecretRef;
  const nginxConfig = generateNginxConfig({ serverName, apiPort, webPort });
  const nginxPath = join(".auto-forge", "nginx", `${safeSiteName(serverName)}.conf`);
  const setup = buildControllerSetup({
    openClawBaseUrl,
    openClawToken,
    telegramBotToken,
    telegramTestChatId
  });
  const envValues = buildVpsEnvValues({
    publicBaseUrl,
    apiPort,
    webPort,
    openClawBaseUrl,
    openClawToken,
    telegramBotToken,
    telegramTestChatId,
    codexAuthRef,
    setupPath
  });

  if (dryRun) {
    printJson({
      ok: true,
      dryRun: true,
      setupCommand: "npm run setup:vps",
      envFile: envPath,
      setupPath,
      nginxPath,
      setup,
      envKeys: Object.keys(envValues).sort(),
      nginxConfig
    });
    return;
  }

  await writeEnvBlock(envPath, envValues);
  Object.assign(process.env, envValues);
  await new FileSetupStore(setupPath).write(setup);
  await mkdir(join(".auto-forge", "nginx"), { recursive: true });
  await writeFile(nginxPath, nginxConfig, { mode: 0o644 });
  printJson({
    ok: true,
    setupCommand: "npm run setup:vps",
    envFile: envPath,
    setupPath,
    nginxPath,
    openClawManualSettings: new URL("/telegram/command", publicBaseUrl).toString()
  });
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
  setup-vps [--runtime-env-file <path>] [--setup-path <path>] [--dry-run]
                                  Guided fresh-VPS setup for Nginx, OpenClaw, Telegram, Codex, and live smoke
  setup-vps --non-interactive --public-base-url <url> --openclaw-base-url <url>
                                  Generate the same setup artifacts from explicit env references
  install-check                   Dry-run the documented install surface
  recover --action <name> [--task <id>] [--dry-run]
                                  Record stuck-task recovery intent
  logs --task <id>                List task log files
  logs --service <name>           Discover service logs for api, worker, web, or postgres
`);
}

async function question(rl: ReturnType<typeof createInterface>, prompt: string, defaultValue: string): Promise<string> {
  const answer = (await rl.question(`${prompt} [${defaultValue}]: `)).trim();
  return answer || defaultValue;
}

async function yesNo(rl: ReturnType<typeof createInterface>, prompt: string, defaultValue: boolean): Promise<boolean> {
  const suffix = defaultValue ? "Y/n" : "y/N";
  const answer = (await rl.question(`${prompt} [${suffix}]: `)).trim().toLowerCase();
  if (!answer) {
    return defaultValue;
  }
  return answer === "y" || answer === "yes";
}

async function promptSecret(
  rl: ReturnType<typeof createInterface>,
  label: string,
  envName: string
): Promise<{ envName: string; value?: string; ref?: SecretRef }> {
  const answer = (await rl.question(`${label} raw value or env:/secret: reference [env:${envName}]: `)).trim();
  if (!answer) {
    return { envName, ref: `env:${envName}` };
  }
  if (answer.startsWith("env:") || answer.startsWith("secret:")) {
    return { envName: answer.startsWith("env:") ? answer.slice("env:".length) : envName, ref: answer as SecretRef };
  }
  process.env[envName] = answer;
  return { envName, value: answer };
}

async function promptTelegramChatId(
  rl: ReturnType<typeof createInterface>,
  telegramBotToken: { envName: string; value?: string; ref?: SecretRef }
): Promise<string> {
  const defaultChatId = process.env.TELEGRAM_TEST_CHAT_ID ?? "discover";
  const answer = await question(rl, 'Telegram chat ID, or "discover" to call getUpdates', defaultChatId);
  if (answer !== "discover") {
    return answer;
  }

  const token = telegramBotToken.value ?? (telegramBotToken.ref?.startsWith("env:") ? process.env[telegramBotToken.ref.slice("env:".length)] : undefined);
  if (!token) {
    throw new Error("Telegram chat discovery requires a raw token or resolvable env:TELEGRAM_BOT_TOKEN value");
  }
  const candidates = await discoverTelegramChatIds({ botToken: token });
  if (candidates.length === 0) {
    throw new Error("Telegram getUpdates returned no chats. Send a message to the bot, then rerun setup.");
  }
  console.log("Discovered Telegram chats:");
  for (const candidate of candidates) {
    const label = candidate.title ?? candidate.username ?? [candidate.firstName, candidate.lastName].filter(Boolean).join(" ") ?? candidate.type ?? "chat";
    console.log(`  ${candidate.chatId} ${label}`);
  }
  return question(rl, "Telegram chat ID to use", candidates[0]?.chatId ?? "");
}

async function promptCodexAuth(
  rl: ReturnType<typeof createInterface>,
  dryRun: boolean
): Promise<{ codexAuthRef: SecretRef; codexApiKey?: { envName: string; value?: string; ref?: SecretRef } }> {
  const mode = (await question(rl, "Codex auth mode: api-key or oauth", "api-key")).toLowerCase();
  if (mode === "oauth") {
    const accepted = (await rl.question("OAuth/manual login is only for a trusted locked-down machine. Type I UNDERSTAND to continue: ")).trim();
    if (accepted !== "I UNDERSTAND") {
      throw new Error("Codex OAuth setup cancelled because trusted-machine constraints were not accepted");
    }
    if (!dryRun) {
      await runCommand("codex", ["login"]);
    }
    return { codexAuthRef: "secret:codex-oauth-local-cache" };
  }

  const codexApiKey = await promptSecret(rl, "OpenAI API key for Codex", "OPENAI_API_KEY");
  if (codexApiKey.value) {
    process.env.OPENAI_API_KEY = codexApiKey.value;
  }
  return { codexAuthRef: "env:OPENAI_API_KEY", codexApiKey };
}

async function hydrateEnvFromFile(path: string): Promise<void> {
  try {
    const values = parseEnvFile(await readFile(path, "utf8"));
    for (const [key, value] of Object.entries(values)) {
      process.env[key] ??= value;
    }
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}

function normalizePublicBaseUrl(value: string): string {
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, "");
}

function safeSiteName(serverName: string): string {
  return serverName.toLowerCase().replace(/[^a-z0-9.-]/g, "-");
}

function envNameFromRef(ref: string): string {
  return ref.startsWith("env:") ? ref.slice("env:".length) : "UNMANAGED_SECRET_REF";
}

async function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with ${code ?? 1}`));
    });
  });
}
