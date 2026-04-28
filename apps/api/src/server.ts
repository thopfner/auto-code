import Fastify from "fastify";
import { z } from "zod";
import {
  createForgeTask,
  telegramCommandCatalog,
  transitionTask,
  type ControllerSetup,
  type SecretRef,
  type SetupCheckResult,
  type SetupStore,
  type SetupValidationResult,
  type TelegramCommandName
} from "../../../packages/core/src/index.js";
import {
  EnvSecretResolver,
  FileSetupStore,
  HttpOpenClawGatewayAdapter,
  TelegramBotApiAdapter,
  type OpenClawSetupAdapter,
  type TelegramSetupAdapter
} from "../../../packages/adapters/src/index.js";

const secretRefSchema = z.custom<SecretRef>(
  (value) => typeof value === "string" && /^(env|secret):[A-Z0-9_./-]+$/i.test(value),
  "Use env:NAME or secret:name references"
);

const telegramCommandNames = telegramCommandCatalog.map((command) => command.command) as [
  TelegramCommandName,
  ...TelegramCommandName[]
];

const setupRequestSchema = z.object({
  configuredByUserId: z.string().min(1).default("onboarding"),
  openClaw: z.object({
    baseUrl: z.string().url(),
    tokenRef: secretRefSchema,
    agentHookPath: z.string().regex(/^\/[a-z0-9/_-]*$/i).default("/hooks/agent")
  }),
  telegram: z.object({
    botTokenRef: secretRefSchema,
    testChatId: z.string().min(1),
    registerCommands: z.boolean().default(true),
    sendTestMessage: z.boolean().default(true),
    commands: z.array(z.enum(telegramCommandNames)).min(1).default(telegramCommandNames)
  })
});

export interface SetupDependencies {
  setupStore: SetupStore;
  openClaw: OpenClawSetupAdapter;
  telegram: TelegramSetupAdapter;
}

function defaultSetupDependencies(): SetupDependencies {
  const secrets = new EnvSecretResolver();
  return {
    setupStore: new FileSetupStore(),
    openClaw: new HttpOpenClawGatewayAdapter(secrets),
    telegram: new TelegramBotApiAdapter(secrets)
  };
}

export function buildServer(dependencies: Partial<SetupDependencies> = {}) {
  const setupDeps = { ...defaultSetupDependencies(), ...dependencies };
  const server = Fastify({ logger: true });

  server.get("/health", async () => ({
    ok: true,
    service: "auto-forge-api"
  }));

  server.post<{
    Body: {
      id: string;
      repoId: string;
      requestedByUserId: string;
      title: string;
    };
  }>("/tasks", async (request, reply) => {
    const task = createForgeTask(request.body);
    return reply.code(201).send(transitionTask(task, { type: "enqueue" }));
  });

  server.get("/setup", async () => {
    const setup = await setupDeps.setupStore.read();
    return {
      configured: Boolean(setup),
      setup
    };
  });

  server.get("/setup/telegram-commands", async () => ({
    commands: telegramCommandCatalog
  }));

  server.post<{ Body: unknown }>("/setup/validate", async (request, reply) => {
    const setup = normalizeSetup(setupRequestSchema.parse(request.body));
    const result = await validateSetup(setup, setupDeps);
    return reply.code(result.ok ? 200 : 422).send(result);
  });

  server.post<{ Body: unknown }>("/setup", async (request, reply) => {
    const setup = normalizeSetup(setupRequestSchema.parse(request.body));
    const result = await validateSetup(setup, setupDeps);
    if (!result.ok) {
      return reply.code(422).send(result);
    }

    await setupDeps.setupStore.write(result.sanitizedSetup);
    return reply.code(201).send(result);
  });

  return server;
}

export async function validateSetup(
  setup: ControllerSetup,
  dependencies: Pick<SetupDependencies, "openClaw" | "telegram">
): Promise<SetupValidationResult> {
  const checks: SetupCheckResult[] = [];

  await captureCheck(checks, "openclaw_health", async () => {
    const health = await dependencies.openClaw.checkHealth(setup.openClaw);
    return `Gateway reachable at ${health.endpoint}${health.version ? ` (${health.version})` : ""}`;
  });

  await captureCheck(checks, "telegram_identity", async () => {
    const identity = await dependencies.telegram.getIdentity(setup.telegram.botTokenRef);
    return `Bot identity resolved${identity.username ? ` as @${identity.username}` : ""}`;
  });

  if (setup.telegram.registerCommands) {
    await captureCheck(checks, "telegram_commands", async () => {
      await dependencies.telegram.registerCommands(setup.telegram.botTokenRef, setup.telegram.commands);
      return `Registered ${setup.telegram.commands.length} Telegram commands`;
    });
  } else {
    checks.push({ name: "telegram_commands", status: "skipped", message: "Command registration disabled" });
  }

  if (setup.telegram.sendTestMessage) {
    await captureCheck(checks, "telegram_outbound", async () => {
      await dependencies.telegram.sendMessage(
        setup.telegram.botTokenRef,
        setup.telegram.testChatId,
        "Auto Forge Controller Telegram setup check passed."
      );
      return "Direct Telegram outbound message delivered";
    });

    await captureCheck(checks, "openclaw_telegram_outbound", async () => {
      await dependencies.openClaw.sendTelegramStatus(
        setup.openClaw,
        setup.telegram.testChatId,
        "Auto Forge Controller OpenClaw routed setup check passed."
      );
      return "OpenClaw routed Telegram delivery accepted";
    });
  } else {
    checks.push({ name: "telegram_outbound", status: "skipped", message: "Telegram test message disabled" });
    checks.push({
      name: "openclaw_telegram_outbound",
      status: "skipped",
      message: "OpenClaw routed Telegram test disabled"
    });
  }

  return {
    ok: checks.every((check) => check.status !== "failed"),
    checks,
    sanitizedSetup: setup
  };
}

function normalizeSetup(setup: z.infer<typeof setupRequestSchema>): ControllerSetup {
  const baseUrl = new URL(setup.openClaw.baseUrl);
  baseUrl.pathname = baseUrl.pathname.replace(/\/+$/, "");
  const agentHookPath = setup.openClaw.agentHookPath === "/" ? "/hooks/agent" : setup.openClaw.agentHookPath;

  return {
    configuredByUserId: setup.configuredByUserId,
    updatedAt: new Date().toISOString(),
    openClaw: {
      baseUrl: baseUrl.toString().replace(/\/$/, ""),
      tokenRef: setup.openClaw.tokenRef,
      agentHookPath
    },
    telegram: {
      botTokenRef: setup.telegram.botTokenRef,
      testChatId: setup.telegram.testChatId,
      registerCommands: setup.telegram.registerCommands,
      sendTestMessage: setup.telegram.sendTestMessage,
      commands: setup.telegram.commands
    }
  };
}

async function captureCheck(
  checks: SetupCheckResult[],
  name: SetupCheckResult["name"],
  operation: () => Promise<string>
): Promise<void> {
  try {
    checks.push({ name, status: "passed", message: await operation() });
  } catch (error) {
    checks.push({
      name,
      status: "failed",
      message: error instanceof Error ? error.message : "Unknown setup validation failure"
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = buildServer();
  const port = Number(process.env.PORT ?? 3000);
  await server.listen({ host: "0.0.0.0", port });
}
