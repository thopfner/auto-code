import Fastify from "fastify";
import { z } from "zod";
import {
  ForgeWorkflowEngine,
  MemoryWorkflowStore,
  createForgeTask,
  telegramCommandCatalog,
  transitionTask,
  type ControllerSetup,
  type ForgeRunner,
  type OperatorGateway,
  type SecretRef,
  type SetupCheckResult,
  type SetupStore,
  type SetupValidationResult,
  type TelegramCommandName,
  type WorkflowEngineOptions,
  type WorkflowStore
} from "../../../packages/core/src/index.js";
import {
  CodexCliRunner,
  EnvSecretResolver,
  FileSetupStore,
  HttpOpenClawGatewayAdapter,
  TelegramBotApiAdapter,
  type OpenClawSetupAdapter,
  type TelegramSetupAdapter
} from "../../../packages/adapters/src/index.js";
import { collectHealth } from "../../../packages/ops/src/index.js";

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
  workflowStore: WorkflowStore;
  runner: ForgeRunner;
  operator?: OperatorGateway;
  workflowOptions?: Partial<WorkflowEngineOptions>;
}

function defaultSetupDependencies(): SetupDependencies {
  const secrets = new EnvSecretResolver();
  const setupStore = new FileSetupStore();
  const openClaw = new HttpOpenClawGatewayAdapter(secrets);
  return {
    setupStore,
    openClaw,
    telegram: new TelegramBotApiAdapter(secrets),
    workflowStore: new MemoryWorkflowStore(),
    runner: new CodexCliRunner(secrets),
    operator: new SetupBackedOperatorGateway(setupStore, openClaw)
  };
}

export function buildServer(dependencies: Partial<SetupDependencies> = {}) {
  const setupDeps = { ...defaultSetupDependencies(), ...dependencies };
  const server = Fastify({ logger: true });
  const workflow = new ForgeWorkflowEngine(
    setupDeps.workflowStore,
    setupDeps.runner,
    setupDeps.operator ?? new SetupBackedOperatorGateway(setupDeps.setupStore, setupDeps.openClaw),
    {
      briefPath:
        setupDeps.workflowOptions?.briefPath ??
        process.env.AUTO_FORGE_ACTIVE_BRIEF_PATH ??
        "docs/exec-plans/active/2026-04-28-auto-forge-controller",
      artifactRoot: setupDeps.workflowOptions?.artifactRoot ?? process.env.AUTO_FORGE_ARTIFACT_ROOT,
      promptRoot: setupDeps.workflowOptions?.promptRoot ?? process.env.AUTO_FORGE_PROMPT_ROOT,
      maxRoleRetries: setupDeps.workflowOptions?.maxRoleRetries,
      idFactory: setupDeps.workflowOptions?.idFactory
    }
  );

  server.get<{ Querystring: { liveExternal?: string } }>("/health", async (request, reply) => {
    const health = await collectHealth({ liveExternal: request.query.liveExternal === "true" });
    return reply.code(health.ok ? 200 : 503).send({
      ...health,
      api: { ok: true, service: "auto-forge-api" }
    });
  });

  server.get("/live", async () => ({
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

  server.get("/workflow/tasks", async () => ({
    tasks: await setupDeps.workflowStore.listTasks()
  }));

  server.post<{ Body: unknown }>("/telegram/command", async (request, reply) => {
    const command = telegramCommandSchema.parse(request.body);
    await ensureDefaultWorkflowRecords(setupDeps.workflowStore);
    const parsed = parseTelegramCommand(command.text, command.title);
    if (parsed.command === "scope") {
      const task = await workflow.handleScopeCommand({
        repoId: command.repoId ?? "default-repo",
        requestedByUserId: command.userId ?? "telegram-owner",
        title: parsed.title
      });
      return reply.code(202).send({ task });
    }

    return reply.code(400).send({ error: `Unsupported command: ${parsed.command}` });
  });

  server.post<{ Params: { approvalId: string }; Body: unknown }>("/approvals/:approvalId/respond", async (request) => {
    const response = approvalResponseSchema.parse(request.body);
    const task = await workflow.resumeApproval({
      approvalId: request.params.approvalId,
      userId: response.userId,
      text: response.text,
      approved: response.approved
    });
    return { task };
  });

  server.post<{ Params: { taskId: string }; Body: unknown }>("/workflow/tasks/:taskId/cancel", async (request) => {
    const response = cancelTaskSchema.parse(request.body);
    const task = await workflow.cancelTask(request.params.taskId, response.reason);
    return { task };
  });

  server.post<{ Params: { taskId: string }; Body: unknown }>("/workflow/tasks/:taskId/recover", async (request, reply) => {
    const recovery = recoveryTaskSchema.parse(request.body);
    const task = await setupDeps.workflowStore.getTask(request.params.taskId);
    if (!task) {
      return reply.code(404).send({ error: `Task not found: ${request.params.taskId}` });
    }

    if (recovery.action === "cancel") {
      return { task: await workflow.cancelTask(task.id, recovery.reason) };
    }

    const recovered = {
      ...task,
      status: "blocked" as const,
      blockedReason: recovery.reason,
      updatedAt: new Date()
    };
    await setupDeps.workflowStore.saveTask(recovered);
    await setupDeps.workflowStore.appendEvent({
      taskId: task.id,
      eventType: "operator_recovery_blocked",
      payload: { reason: recovery.reason },
      createdAt: new Date()
    });
    return { task: recovered };
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

const telegramCommandSchema = z.object({
  text: z.string().min(1),
  title: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  repoId: z.string().min(1).optional()
});

const approvalResponseSchema = z.object({
  userId: z.string().min(1).default("telegram-owner"),
  text: z.string().default("Approved"),
  approved: z.boolean().default(true)
});

const cancelTaskSchema = z.object({
  reason: z.string().min(1).default("Cancelled by operator")
});

const recoveryTaskSchema = z.object({
  action: z.enum(["mark-blocked", "cancel"]),
  reason: z.string().min(1).default("Recovered by operator")
});

class SetupBackedOperatorGateway implements OperatorGateway {
  constructor(
    private readonly setupStore: SetupStore,
    private readonly openClaw: OpenClawSetupAdapter
  ) {}

  async sendStatus(message: { userId: string; text: string }): Promise<void> {
    await this.deliver(message.text);
  }

  async sendApprovalRequest(message: { userId: string; text: string; approvalId: string; buttons?: Array<{ label: string; value: string }> }): Promise<void> {
    const buttons = message.buttons?.map((button) => `[${button.label}: ${button.value}]`).join(" ");
    await this.deliver(`${message.text}\nApproval: ${message.approvalId}${buttons ? `\n${buttons}` : ""}`);
  }

  private async deliver(text: string): Promise<void> {
    const setup = await this.setupStore.read();
    if (!setup) {
      console.warn(`Operator message skipped because setup is not configured: ${text}`);
      return;
    }
    await this.openClaw.sendTelegramStatus(setup.openClaw, setup.telegram.testChatId, text);
  }
}

async function ensureDefaultWorkflowRecords(store: WorkflowStore): Promise<void> {
  if (!(await store.getUser("telegram-owner"))) {
    await store.saveUser({
      id: "telegram-owner",
      telegramUserId: process.env.TELEGRAM_TEST_CHAT_ID ?? "local-telegram-owner",
      displayName: "Telegram Owner",
      role: "owner",
      createdAt: new Date()
    });
  }
  if (!(await store.getRepo("default-repo"))) {
    await store.saveRepo({
      id: "default-repo",
      name: process.env.AUTO_FORGE_REPO_NAME ?? "auto-forge-controller",
      repoPath: process.env.AUTO_FORGE_REPO_PATH ?? process.cwd(),
      defaultBranch: process.env.AUTO_FORGE_DEFAULT_BRANCH ?? "main",
      isPaused: false,
      createdAt: new Date()
    });
  }
  for (const role of ["scope", "planner", "worker", "qa"] as const) {
    if (!(await store.getRunnerProfile(role))) {
      await store.saveRunnerProfile({
        id: `default-${role}`,
        name: `Default ${role}`,
        role,
        codexAuthRef: (process.env.CODEX_AUTH_REF as SecretRef | undefined) ?? "env:OPENAI_API_KEY",
        createdAt: new Date()
      });
    }
  }
}

function parseTelegramCommand(text: string, fallbackTitle?: string): { command: string; title: string } {
  const trimmed = text.trim();
  const [rawCommand, ...rest] = trimmed.split(/\s+/);
  const command = rawCommand?.replace(/^\//, "") ?? "";
  const title = fallbackTitle ?? rest.join(" ").trim();
  return {
    command,
    title: title || "Untitled Forge task"
  };
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
