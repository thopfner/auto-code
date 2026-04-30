import { execFile } from "node:child_process";
import { access, mkdir, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve as resolvePath } from "node:path";
import { promisify } from "node:util";
import Fastify from "fastify";
import { z } from "zod";
import {
  ForgeWorkflowEngine,
  MemoryWorkflowStore,
  RetryModeRefusedError,
  createForgeTask,
  telegramCommandCatalog,
  transitionTask,
  type ControllerSetup,
  type ForgeTask,
  type ForgeRunner,
  type OperatorGateway,
  type RepoRegistration,
  type SecretRef,
  type SetupCheckResult,
  type SetupStore,
  type SetupValidationResult,
  type TaskRetryMode,
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
import {
  GitHubSshKeyManager,
  collectHealth,
  formatKeyInfoForOperator,
  listTaskLogs,
  type GitHubSshKeyManagerOptions
} from "../../../packages/ops/src/index.js";
import { PostgresWorkflowStore } from "../../../packages/db/src/index.js";

const execFileAsync = promisify(execFile);

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
  openClaw: z
    .object({
      baseUrl: z.string().url(),
      mode: z.enum(["detect-existing", "install-or-onboard", "configure-later", "advanced-webhook"]).default("detect-existing"),
      authRef: secretRefSchema.optional(),
      tokenRef: secretRefSchema.optional(),
      agentHookPath: z.string().regex(/^\/[a-z0-9/_-]*$/i).default("/hooks/agent"),
      discovery: z
        .object({
          source: z.enum(["openclaw-cli", "manual", "deferred", "legacy"]),
          status: z.enum(["detected", "missing-cli", "not-running", "configure-later", "advanced-webhook", "legacy"]),
          command: z.string().optional(),
          message: z.string().optional()
        })
        .optional()
    })
    .superRefine((openClaw, context) => {
      if (openClaw.mode === "advanced-webhook" && !(openClaw.authRef ?? openClaw.tokenRef)) {
        context.addIssue({
          code: "custom",
          message: "Advanced OpenClaw webhook mode requires authRef",
          path: ["authRef"]
        });
      }
    }),
  telegram: z.object({
    botTokenRef: secretRefSchema,
    testChatId: z.string().min(1),
    registerCommands: z.boolean().default(true),
    sendTestMessage: z.boolean().default(true),
    commands: z.array(z.enum(telegramCommandNames)).min(1).default(telegramCommandNames)
  })
});

const telegramWebhookSchema = z
  .object({
    message: z
      .object({
        text: z.string().optional(),
        chat: z.object({ id: z.union([z.string(), z.number()]) }),
        from: z.object({ id: z.union([z.string(), z.number()]).optional() }).optional()
      })
      .optional()
  })
  .passthrough();

export interface SetupDependencies {
  setupStore: SetupStore;
  openClaw: OpenClawSetupAdapter;
  telegram: TelegramSetupAdapter;
  workflowStore: WorkflowStore;
  runner: ForgeRunner;
  operator?: OperatorGateway;
  workflowOptions?: Partial<WorkflowEngineOptions>;
  repoRegistry?: Partial<RepoRegistryOptions>;
  repoSshKeys?: Partial<GitHubSshKeyManagerOptions>;
}

interface RepoRegistryOptions {
  allowedRoots: string[];
  cloneGitRepo: (gitUrl: string, targetPath: string) => Promise<void>;
}

function defaultSetupDependencies(): SetupDependencies {
  const secrets = new EnvSecretResolver();
  const setupStore = new FileSetupStore();
  const openClaw = new HttpOpenClawGatewayAdapter(secrets);
  const telegram = new TelegramBotApiAdapter(secrets);
  return {
    setupStore,
    openClaw,
    telegram,
    workflowStore: new MemoryWorkflowStore(),
    runner: new CodexCliRunner(secrets),
    operator: new SetupBackedTelegramOperatorGateway(setupStore, telegram)
  };
}

export function buildServer(dependencies: Partial<SetupDependencies> = {}) {
  const setupDeps = { ...defaultSetupDependencies(), ...dependencies };
  if (!dependencies.workflowStore && process.env.DATABASE_URL) {
    setupDeps.workflowStore = new PostgresWorkflowStore({ connectionString: process.env.DATABASE_URL });
  }
  const repoRegistry = buildRepoRegistryOptions(setupDeps.repoRegistry);
  const repoSshKeys = buildRepoSshKeyManager(setupDeps.repoSshKeys);
  const server = Fastify({ logger: true });
  const workflow = new ForgeWorkflowEngine(
    setupDeps.workflowStore,
    setupDeps.runner,
    setupDeps.operator ?? new SetupBackedTelegramOperatorGateway(setupDeps.setupStore, setupDeps.telegram),
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

  server.addHook("onReady", async () => {
    const readiness = await setupDeps.workflowStore.checkReadiness();
    if (!readiness.ready) {
      throw new Error(`Workflow store is not ready (${readiness.mode}): ${readiness.message}`);
    }
  });

  server.get<{ Querystring: { liveExternal?: string } }>("/health", async (request, reply) => {
    const health = await collectHealth({
      liveExternal: request.query.liveExternal === "true",
      workflowStore: setupDeps.workflowStore
    });
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

  server.get<{ Params: { taskId: string } }>("/workflow/tasks/:taskId/status", async (request, reply) => {
    const status = await buildTaskStatusSummary(setupDeps.workflowStore, workflow, request.params.taskId);
    if (!status) {
      return reply.code(404).send({ error: `Task not found: ${request.params.taskId}` });
    }
    return status;
  });

  server.get<{ Params: { taskId: string } }>("/workflow/tasks/:taskId/logs", async (request, reply) => {
    const logs = await buildTaskLogSummary(setupDeps.workflowStore, request.params.taskId);
    if (!logs) {
      return reply.code(404).send({ error: `Task not found: ${request.params.taskId}` });
    }
    return logs;
  });

  server.get("/workflow/store", async (request, reply) => {
    const readiness = await setupDeps.workflowStore.checkReadiness();
    return reply.code(readiness.ready ? 200 : 503).send(readiness);
  });

  server.post<{ Body: unknown }>("/telegram/command", async (request, reply) => {
    const command = telegramCommandSchema.parse(request.body);
    await ensureDefaultWorkflowRecords(setupDeps.workflowStore);
    const parsed = parseTelegramCommand(command.text, command.title);
    const userId = command.userId ?? "telegram-owner";

    if (parsed.command === "scope") {
      try {
        const repo = await resolveScopeRepo(setupDeps.workflowStore, userId, command.repoId, parsed.explicitRepoAlias);
        const task = await workflow.handleScopeCommand({
          repoId: repo.id,
          requestedByUserId: userId,
          title: parsed.title
        });
        return reply.code(202).send({ task });
      } catch (error) {
        if (error instanceof RepoCommandError) {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    }

    if (parsed.command === "repos" || parsed.command === "repo") {
      try {
        const result = await handleRepoRegistryCommand({
          store: setupDeps.workflowStore,
          parsed,
          userId,
          options: repoRegistry,
          keyManager: repoSshKeys
        });
        return reply.code(result.statusCode).send(result.body);
      } catch (error) {
        if (error instanceof RepoCommandError) {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    }

    if (parsed.command === "task") {
      const result = await handleTaskCommand({
        parsed,
        workflow,
        workflowStore: setupDeps.workflowStore
      });
      return reply.code(result.statusCode).send(result.body);
    }

    return reply.code(400).send({ error: `Unsupported command: ${parsed.command}` });
  });

  server.post<{ Body: unknown }>("/telegram/webhook", async (request, reply) => {
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    if (expectedSecret) {
      const actualSecret = request.headers["x-telegram-bot-api-secret-token"];
      if (actualSecret !== expectedSecret) {
        return reply.code(401).send({ error: "Invalid Telegram webhook secret" });
      }
    }

    const update = telegramWebhookSchema.parse(request.body);
    const message = update.message;
    if (!message?.text) {
      return { ok: true, skipped: "non-text-message" };
    }

    void handleTelegramWebhookCommand({
      text: message.text,
      chatId: String(message.chat.id),
      userId: message.from?.id !== undefined ? String(message.from.id) : String(message.chat.id),
      setupStore: setupDeps.setupStore,
      telegram: setupDeps.telegram,
      workflowStore: setupDeps.workflowStore,
      workflow,
      repoRegistry,
      keyManager: repoSshKeys,
      logger: server.log
    });

    return { ok: true };
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

  server.post<{ Params: { taskId: string }; Body: unknown }>("/workflow/tasks/:taskId/retry", async (request, reply) => {
    const response = retryTaskSchema.parse(request.body);
    try {
      const task = await workflow.retryTask(request.params.taskId, response.reason, response.mode);
      return { task };
    } catch (error) {
      if (error instanceof RetryModeRefusedError) {
        return reply.code(409).send({ error: error.message, choices: error.choices });
      }
      throw error;
    }
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

    if (recovery.action === "retry") {
      try {
        return { task: await workflow.retryTask(task.id, recovery.reason, recovery.mode) };
      } catch (error) {
        if (error instanceof RetryModeRefusedError) {
          return reply.code(409).send({ error: error.message, choices: error.choices });
        }
        throw error;
      }
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

const retryTaskSchema = z.object({
  reason: z.string().min(1).default("Retried by operator"),
  mode: z.enum(["auto", "publish", "from-blocker"]).default("auto")
});

const recoveryTaskSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("mark-blocked"),
    reason: z.string().min(1).default("Recovered by operator")
  }),
  z.object({
    action: z.literal("cancel"),
    reason: z.string().min(1).default("Recovered by operator")
  }),
  z.object({
    action: z.literal("retry"),
    mode: z.enum(["publish", "from-blocker"]),
    reason: z.string().min(1).default("Retried by operator")
  })
]);

class SetupBackedTelegramOperatorGateway implements OperatorGateway {
  constructor(
    private readonly setupStore: SetupStore,
    private readonly telegram: TelegramSetupAdapter
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
    await this.telegram.sendMessage(setup.telegram.botTokenRef, setup.telegram.testChatId, text);
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
  const codexAuthRef = (process.env.CODEX_AUTH_REF as SecretRef | undefined) ?? "env:OPENAI_API_KEY";
  const codexModel = process.env.AUTO_FORGE_CODEX_MODEL?.trim() || undefined;
  for (const role of ["scope", "planner", "worker", "qa"] as const) {
    if (!(await store.getRunnerProfile(role))) {
      await store.saveRunnerProfile({
        id: `default-${role}`,
        name: `Default ${role}`,
        role,
        codexAuthRef,
        model: codexModel,
        createdAt: new Date()
      });
    }
  }
}

interface TelegramWebhookCommandInput {
  text: string;
  chatId: string;
  userId: string;
  setupStore: SetupStore;
  telegram: TelegramSetupAdapter;
  workflowStore: WorkflowStore;
  workflow: ForgeWorkflowEngine;
  repoRegistry: RepoRegistryOptions;
  keyManager: GitHubSshKeyManager;
  logger: Pick<ReturnType<typeof Fastify>["log"], "error">;
}

async function handleTelegramWebhookCommand(input: TelegramWebhookCommandInput): Promise<void> {
  try {
    const setup = await input.setupStore.read();
    if (!setup) {
      return;
    }

    const parsed = parseTelegramCommand(input.text);
    if (!isAuthorizedTelegramOperator(setup, input.chatId, input.userId)) {
      await input.telegram.sendMessage(setup.telegram.botTokenRef, input.chatId, "You are not authorized to use this command.");
      input.logger.error(
        {
          chatId: input.chatId,
          userId: input.userId,
          configuredChatId: setup.telegram.testChatId
        },
        "Unauthorized Telegram command rejected"
      );
      return;
    }

    if (parsed.command === "repos" || parsed.command === "repo") {
      await ensureDefaultWorkflowRecords(input.workflowStore);
      try {
        const result = await handleRepoRegistryCommand({
          store: input.workflowStore,
          parsed,
          userId: `telegram:${input.userId}`,
          options: input.repoRegistry,
          keyManager: input.keyManager
        });
        await input.telegram.sendMessage(setup.telegram.botTokenRef, input.chatId, result.body.message);
      } catch (error) {
        await input.telegram.sendMessage(
          setup.telegram.botTokenRef,
          input.chatId,
          error instanceof Error ? error.message : "Repo command failed."
        );
      }
      return;
    }

    if (parsed.command === "scope") {
      await ensureDefaultWorkflowRecords(input.workflowStore);
      let repoId: string;
      try {
        repoId = (await resolveScopeRepo(input.workflowStore, `telegram:${input.userId}`, undefined, parsed.explicitRepoAlias)).id;
      } catch (error) {
        await input.telegram.sendMessage(
          setup.telegram.botTokenRef,
          input.chatId,
          error instanceof Error ? error.message : "Unable to resolve repo."
        );
        return;
      }
      const task = await input.workflow.enqueueScopeCommand({
        repoId,
        requestedByUserId: `telegram:${input.userId}`,
        title: parsed.title
      });
      await input.telegram.sendMessage(
        setup.telegram.botTokenRef,
        input.chatId,
        [`Queued: ${parsed.title}`, `Task: ${task.id}`, `Status: /task status ${task.id}`, `Logs: /task logs ${task.id}`].join("\n")
      );
      void (async () => {
        await input.workflow.runQueuedTask(task.id);
      })().catch((error) => {
        input.logger.error({ err: error }, "Telegram scope workflow failed");
      });
      return;
    }

    if (parsed.command === "task") {
      await ensureDefaultWorkflowRecords(input.workflowStore);
      try {
        const result = await handleTaskCommand({
          parsed,
          workflow: input.workflow,
          workflowStore: input.workflowStore,
          runInBackground: true,
          logger: input.logger
        });
        await input.telegram.sendMessage(setup.telegram.botTokenRef, input.chatId, result.body.message);
      } catch (error) {
        await input.telegram.sendMessage(
          setup.telegram.botTokenRef,
          input.chatId,
          error instanceof Error ? error.message : "Task command failed."
        );
      }
      return;
    }

    if (parsed.command === "status") {
      const tasks = await input.workflowStore.listTasks();
      const active = tasks.filter((task) => !["completed", "cancelled", "blocked"].includes(task.status));
      const recent = tasks.slice(-5).reverse();
      const lines = [`Auto Forge is running. Active tasks: ${active.length}. Total tasks: ${tasks.length}.`];
      if (recent.length > 0) {
        lines.push("Recent:");
        lines.push(...recent.map(formatCompactTaskLine));
      }
      await input.telegram.sendMessage(setup.telegram.botTokenRef, input.chatId, lines.join("\n"));
      return;
    }

    if (parsed.command === "queue") {
      const tasks = await input.workflowStore.listTasks();
      const queued = tasks.filter((task) => !["completed", "cancelled"].includes(task.status)).slice(-5);
      const text =
        queued.length === 0
          ? "Queue is empty."
          : queued.map(formatCompactTaskLine).join("\n");
      await input.telegram.sendMessage(setup.telegram.botTokenRef, input.chatId, text);
      return;
    }

    await input.telegram.sendMessage(setup.telegram.botTokenRef, input.chatId, `Unsupported command: /${parsed.command || "unknown"}`);
  } catch (error) {
    input.logger.error({ err: error }, "Telegram webhook command handling failed");
  }
}

function formatCompactTaskLine(task: Pick<ForgeTask, "id" | "status" | "title">): string {
  return `${task.id} ${task.status}: ${truncateLine(task.title, 120)}`;
}

function isAuthorizedTelegramOperator(setup: ControllerSetup, chatId: string, userId: string): boolean {
  const allowedIds = new Set([
    setup.telegram.testChatId,
    process.env.TELEGRAM_OPERATOR_CHAT_ID,
    process.env.TELEGRAM_OPERATOR_USER_ID
  ].filter((value): value is string => Boolean(value)));

  return allowedIds.has(chatId) || allowedIds.has(userId);
}

interface ParsedTelegramCommand {
  command: string;
  title: string;
  args: string[];
  explicitRepoAlias?: string;
}

function parseTelegramCommand(text: string, fallbackTitle?: string): ParsedTelegramCommand {
  const trimmed = text.trim();
  const [rawCommand, ...rest] = trimmed.split(/\s+/);
  const command = rawCommand?.replace(/^\//, "").split("@")[0] ?? "";
  let titleArgs = rest;
  let explicitRepoAlias: string | undefined;
  if (command === "scope" && rest[0]?.startsWith("@")) {
    explicitRepoAlias = rest[0].slice(1);
    titleArgs = rest.slice(1);
  }
  const title = fallbackTitle ?? titleArgs.join(" ").trim();
  return {
    command,
    args: rest,
    explicitRepoAlias,
    title: title || "Untitled Forge task"
  };
}

class RepoCommandError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400
  ) {
    super(message);
  }
}

interface RepoRegistryCommandInput {
  store: WorkflowStore;
  parsed: ParsedTelegramCommand;
  userId: string;
  options: RepoRegistryOptions;
  keyManager: GitHubSshKeyManager;
}

interface RepoRegistryCommandResult {
  statusCode: number;
  body: {
    message: string;
    repos?: RepoRegistration[];
    repo?: RepoRegistration;
    activeRepoId?: string;
  };
}

interface TaskCommandInput {
  parsed: ParsedTelegramCommand;
  workflow: ForgeWorkflowEngine;
  workflowStore: WorkflowStore;
  runInBackground?: boolean;
  logger?: Pick<ReturnType<typeof Fastify>["log"], "error">;
}

interface TaskCommandResult {
  statusCode: number;
  body: {
    message: string;
    task?: unknown;
    status?: unknown;
    logs?: unknown;
    choices?: string[];
  };
}

async function handleTaskCommand(input: TaskCommandInput): Promise<TaskCommandResult> {
  const [subcommand, taskId, ...args] = input.parsed.args;
  if (!subcommand || !taskId || !["retry", "status", "logs"].includes(subcommand)) {
    throw new RepoCommandError("Usage: /task <status|logs|retry> <task-id>", 400);
  }

  const task = await input.workflowStore.getTask(taskId);
  if (!task) {
    throw new RepoCommandError(`Task not found: ${taskId}`, 404);
  }

  if (subcommand === "status") {
    const status = await buildTaskStatusSummary(input.workflowStore, input.workflow, taskId);
    if (!status) {
      throw new RepoCommandError(`Task not found: ${taskId}`, 404);
    }
    return {
      statusCode: 200,
      body: {
        message: formatTaskStatusForTelegram(status),
        status
      }
    };
  }

  if (subcommand === "logs") {
    const logs = await buildTaskLogSummary(input.workflowStore, taskId);
    if (!logs) {
      throw new RepoCommandError(`Task not found: ${taskId}`, 404);
    }
    return {
      statusCode: 200,
      body: {
        message: formatTaskLogsForTelegram(logs),
        logs
      }
    };
  }

  if (task.status !== "blocked") {
    throw new RepoCommandError(`Task ${task.id} is ${task.status}; only blocked tasks can be retried.`, 409);
  }

  const requestedMode = parseRetryMode(args[0]);
  const mode = requestedMode.mode;
  const reasonParts = requestedMode.consumedMode ? args.slice(1) : args;
  const reason = reasonParts.join(" ").trim() || "Retried by operator";
  if (input.runInBackground) {
    const advice = await input.workflow.describeTaskRetry(task.id);
    if (mode === "auto" && advice.automaticMode !== "publish") {
      return {
        statusCode: 409,
        body: {
          message: `${advice.nextAction}\nChoices:\n${advice.choices.join("\n")}`,
          choices: advice.choices
        }
      };
    }
    void input.workflow.retryTask(task.id, reason, mode).catch((error) => {
      input.logger?.error({ err: error, taskId: task.id }, "Task retry workflow failed");
    });
    return {
      statusCode: 202,
      body: {
        message: `Retrying task ${task.id}: ${task.title}`
      }
    };
  }

  try {
    const retried = await input.workflow.retryTask(task.id, reason, mode);
    return {
      statusCode: 202,
      body: {
        message: `Retried task ${task.id}: ${retried.status}`,
        task: retried
      }
    };
  } catch (error) {
    if (error instanceof RetryModeRefusedError) {
      return {
        statusCode: 409,
        body: {
          message: `${error.message}\nChoices:\n${error.choices.join("\n")}`,
          choices: error.choices
        }
      };
    }
    throw error;
  }
}

function parseRetryMode(value: string | undefined): { mode: TaskRetryMode; consumedMode: boolean } {
  if (value === "publish" || value === "from-blocker") {
    return { mode: value, consumedMode: true };
  }
  return { mode: "auto", consumedMode: false };
}

async function buildTaskStatusSummary(store: WorkflowStore, workflow: ForgeWorkflowEngine, taskId: string) {
  const task = await store.getTask(taskId);
  if (!task) {
    return undefined;
  }
  const repo = await store.getRepo(task.repoId);
  const events = await store.listEvents(task.id);
  const retry = await workflow
    .describeTaskRetry(task.id)
    .catch(() => ({
      blockerKind: task.status === "blocked" ? ("unsupported" as const) : ("not-blocked" as const),
      choices: [`/task logs ${task.id}`, `/task retry ${task.id} from-blocker <reason>`],
      nextAction: repo
        ? `Automatic retry is refused. After the blocker is fixed, run /task retry ${task.id} from-blocker <reason>.`
        : `Task repo ${task.repoId} is not registered; restore repo registration before retrying.`
    }));
  return {
    task: {
      id: task.id,
      title: task.title,
      status: task.status,
      blockedReason: task.blockedReason,
      updatedAt: task.updatedAt.toISOString()
    },
    repo: repo
      ? {
          id: repo.id,
          alias: repo.name,
          path: repo.repoPath
        }
      : {
          id: task.repoId,
          alias: "unknown",
          path: undefined
        },
    blockerKind: retry.blockerKind,
    latestEvents: events.slice(-5).map((event) => ({
      eventType: event.eventType,
      createdAt: event.createdAt.toISOString()
    })),
    nextAction: retry.nextAction,
    choices: retry.choices
  };
}

async function buildTaskLogSummary(store: WorkflowStore, taskId: string) {
  const task = await store.getTask(taskId);
  if (!task) {
    return undefined;
  }
  const [runAttempts, artifacts, localLogs] = await Promise.all([
    store.listRunAttempts(task.id),
    store.listArtifacts(task.id),
    listTaskLogs(task.id)
  ]);
  return {
    taskId: task.id,
    runLogs: runAttempts
      .filter((run) => Boolean(run.logPath))
      .map((run) => ({
        runId: run.id,
        role: run.role,
        status: run.status,
        path: run.logPath
      })),
    artifacts: artifacts.map((artifact) => ({
      kind: artifact.kind,
      path: artifact.path,
      observedAt: artifact.observedAt.toISOString()
    })),
    recoveryLogs: localLogs,
    message: "Paths only; log contents and secrets are not returned."
  };
}

function formatTaskStatusForTelegram(status: NonNullable<Awaited<ReturnType<typeof buildTaskStatusSummary>>>): string {
  const lines = [
    `Task ${status.task.id}: ${status.task.status}`,
    `Repo: ${status.repo.alias}`,
    `Title: ${status.task.title}`
  ];
  if (status.blockerKind) {
    lines.push(`Blocker: ${status.blockerKind}`);
  }
  if (status.task.blockedReason) {
    lines.push(`Reason: ${truncateLine(status.task.blockedReason, 220)}`);
  }
  if (status.latestEvents.length > 0) {
    lines.push(`Events: ${status.latestEvents.map((event) => event.eventType).join(", ")}`);
  }
  lines.push(`Next: ${status.nextAction}`);
  return lines.join("\n");
}

function formatTaskLogsForTelegram(logs: NonNullable<Awaited<ReturnType<typeof buildTaskLogSummary>>>): string {
  const runPaths = logs.runLogs.map((log) => `${log.role}: ${log.path}`).slice(0, 4);
  const artifactPaths = logs.artifacts.map((artifact) => `${artifact.kind}: ${artifact.path}`).slice(0, 4);
  const recoveryPaths = logs.recoveryLogs.slice(0, 3);
  const lines = [`Task ${logs.taskId} log locations`, "Contents are not sent through Telegram."];
  lines.push(runPaths.length ? `Runs:\n${runPaths.join("\n")}` : "Runs: none recorded");
  lines.push(artifactPaths.length ? `Artifacts:\n${artifactPaths.join("\n")}` : "Artifacts: none recorded");
  if (recoveryPaths.length) {
    lines.push(`Recovery:\n${recoveryPaths.join("\n")}`);
  }
  return lines.join("\n");
}

function truncateLine(value: string, maxLength: number): string {
  const singleLine = value.replace(/\s+/g, " ").trim();
  return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength - 3)}...` : singleLine;
}

function buildRepoRegistryOptions(options: Partial<RepoRegistryOptions> | undefined): RepoRegistryOptions {
  return {
    allowedRoots: options?.allowedRoots ?? configuredAllowedRepoRoots(),
    cloneGitRepo: options?.cloneGitRepo ?? cloneGitRepo
  };
}

function buildRepoSshKeyManager(options: Partial<GitHubSshKeyManagerOptions> | undefined): GitHubSshKeyManager {
  return new GitHubSshKeyManager({
    ...options,
    keyRoot: options?.keyRoot ?? process.env.AUTO_FORGE_SSH_KEY_ROOT ?? "/etc/auto-forge-controller/ssh"
  });
}

function configuredAllowedRepoRoots(): string[] {
  return (process.env.AUTO_FORGE_ALLOWED_REPO_ROOTS ?? "/opt/auto-forge-repos")
    .split(",")
    .map((root) => root.trim())
    .filter(Boolean);
}

async function handleRepoRegistryCommand(input: RepoRegistryCommandInput): Promise<RepoRegistryCommandResult> {
  const [subcommand, ...args] = input.parsed.args;
  if (input.parsed.command === "repos" || !subcommand || subcommand === "list") {
    const repos = await input.store.listRepos();
    const activeRepoId = await input.store.getActiveRepoId(input.userId);
    return {
      statusCode: 200,
      body: {
        activeRepoId: activeRepoId ?? undefined,
        repos,
        message: formatRepoList(repos, activeRepoId)
      }
    };
  }

  if (subcommand === "use") {
    const alias = requireAlias(args[0]);
    const repo = await requireRepoByAlias(input.store, alias);
    if (isControllerSystemRepo(repo)) {
      throw new RepoCommandError(formatControllerRepoRefusal(repo.name), 409);
    }
    if (repo.isPaused) {
      throw new RepoCommandError(`Repo ${alias} is paused. Resume it before selecting it.`, 409);
    }
    const currentRepoId = await activeRepoIdOrDefault(input.store, input.userId);
    await assertNoMutatingTask(input.store, currentRepoId);
    await input.store.setActiveRepoId(input.userId, repo.id);
    await appendRepoRegistryEvent(input.store, repo, input.userId, "use", {});
    return {
      statusCode: 200,
      body: {
        activeRepoId: repo.id,
        repo,
        message: `Active repo set to ${repo.name}.`
      }
    };
  }

  if (subcommand === "add-path") {
    const alias = requireAlias(args[0]);
    const repoPath = args[1];
    if (!repoPath) {
      throw new RepoCommandError("Usage: /repo add-path <alias> <absolute-path>");
    }
    await assertRepoAliasAvailable(input.store, alias);
    const safePath = await resolveSafeExistingGitPath(repoPath, input.options.allowedRoots);
    const repo = await saveRegisteredRepo(input.store, {
      alias,
      repoPath: safePath,
      sshRemote: undefined
    });
    await appendRepoRegistryEvent(input.store, repo, input.userId, "add_path", { repoPath: safePath });
    return {
      statusCode: 201,
      body: {
        repo,
        message: `Registered repo ${repo.name} at ${repo.repoPath}.`
      }
    };
  }

  if (subcommand === "clone") {
    const alias = requireAlias(args[0]);
    const gitUrl = args[1];
    if (!gitUrl) {
      throw new RepoCommandError("Usage: /repo clone <alias> <git-url> [absolute-project-path]");
    }
    validateGitUrl(gitUrl);
    await assertRepoAliasAvailable(input.store, alias);
    const targetPath = args[2]
      ? await safeCloneTargetPath(args[2], input.options.allowedRoots)
      : await safeCloneTarget(alias, input.options.allowedRoots);
    await input.options.cloneGitRepo(gitUrl, targetPath);
    const safePath = await resolveSafeExistingGitPath(targetPath, input.options.allowedRoots);
    const repo = await saveRegisteredRepo(input.store, {
      alias,
      repoPath: safePath,
      sshRemote: gitUrl
    });
    await appendRepoRegistryEvent(input.store, repo, input.userId, "clone", { gitUrl, repoPath: safePath });
    return {
      statusCode: 201,
      body: {
        repo,
        message: `Cloned and registered product repo ${repo.name} at ${repo.repoPath}. Next: /repo use ${repo.name}, then /repo github-setup ${repo.name}.`
      }
    };
  }

  if (subcommand === "key") {
    return handleRepoSshKeyCommand(input, args);
  }

  if (subcommand === "github-setup") {
    const alias = requireAlias(args[0]);
    const repo = await requireRepoByAlias(input.store, alias);
    await appendRepoRegistryEvent(input.store, repo, input.userId, "github_setup", {});
    return {
      statusCode: 200,
      body: {
        repo,
        message: formatGitHubOnboardingPlan(repo)
      }
    };
  }

  if (subcommand === "git-test") {
    const alias = requireAlias(args[0]);
    const repo = await requireRepoByAlias(input.store, alias);
    try {
      const result = await input.keyManager.testGitAccess(repo);
      await appendRepoRegistryEvent(input.store, repo, input.userId, "git_test", { remote: result.remote, pushDryRunOk: true });
      return {
        statusCode: 200,
        body: {
          repo,
          message: result.message
        }
      };
    } catch (error) {
      throw new RepoCommandError(formatGitHubOnboardingPlan(repo, input.keyManager.redactedError(error).message), 502);
    }
  }

  if (subcommand === "pause" || subcommand === "resume") {
    const alias = requireAlias(args[0]);
    const repo = await requireRepoByAlias(input.store, alias);
    const updated = { ...repo, isPaused: subcommand === "pause" };
    await input.store.saveRepo(updated);
    await appendRepoRegistryEvent(input.store, updated, input.userId, subcommand, {});
    return {
      statusCode: 200,
      body: {
        repo: updated,
        message: `Repo ${updated.name} ${updated.isPaused ? "paused" : "resumed"}.`
      }
    };
  }

  throw new RepoCommandError(`Unsupported repo command: ${subcommand}`);
}

async function handleRepoSshKeyCommand(input: RepoRegistryCommandInput, args: string[]): Promise<RepoRegistryCommandResult> {
  const [keySubcommand, aliasValue, ...flags] = args;
  if (!keySubcommand) {
    throw new RepoCommandError("Usage: /repo key <create|show|test|github-add> <alias>");
  }
  const alias = requireAlias(aliasValue);
  const repo = await requireRepoByAlias(input.store, alias);

  try {
    if (keySubcommand === "create") {
      const info = await input.keyManager.createKey(repo);
      await appendRepoRegistryEvent(input.store, repo, input.userId, "key_create", {
        fingerprint: info.fingerprint,
        privateKeyMode: info.privateKeyMode
      });
      return {
        statusCode: 201,
        body: {
          repo,
          message: formatKeyInfoForOperator(info)
        }
      };
    }

    if (keySubcommand === "show") {
      const info = await input.keyManager.describeKey(repo);
      await appendRepoRegistryEvent(input.store, repo, input.userId, "key_show", { fingerprint: info.fingerprint });
      return {
        statusCode: 200,
        body: {
          repo,
          message: formatKeyInfoForOperator(info)
        }
      };
    }

    if (keySubcommand === "test") {
      const result = await input.keyManager.testReadAccess(repo);
      await appendRepoRegistryEvent(input.store, repo, input.userId, "key_test", { remote: result.remote });
      return {
        statusCode: 200,
        body: {
          repo,
          message: result.message
        }
      };
    }

    if (keySubcommand === "github-add") {
      const writeAccess = flags.includes("--write");
      const result = await input.keyManager.addGitHubDeployKey(repo, { writeAccess });
      await appendRepoRegistryEvent(input.store, repo, input.userId, "key_github_add", {
        title: result.title,
        readOnly: result.readOnly,
        id: result.id
      });
      return {
        statusCode: 200,
        body: {
          repo,
          message: `GitHub deploy key added for ${repo.name}: ${result.title} (${result.readOnly ? "read-only" : "write access"}).`
        }
      };
    }
  } catch (error) {
    throw new RepoCommandError(formatGitHubOnboardingPlan(repo, input.keyManager.redactedError(error).message), 502);
  }

  throw new RepoCommandError(`Unsupported repo key command: ${keySubcommand}`);
}

async function resolveScopeRepo(
  store: WorkflowStore,
  userId: string,
  explicitRepoId: string | undefined,
  explicitRepoAlias: string | undefined
): Promise<RepoRegistration> {
  if (explicitRepoId) {
    const repo = await store.getRepo(explicitRepoId);
    if (!repo) {
      throw new RepoCommandError(`Unknown repo id: ${explicitRepoId}`, 404);
    }
    if (repo.isPaused) {
      throw new RepoCommandError(`Repo ${repo.name} is paused.`, 409);
    }
    return repo;
  }

  if (explicitRepoAlias) {
    const repo = await requireRepoByAlias(store, explicitRepoAlias);
    if (repo.isPaused) {
      throw new RepoCommandError(`Repo ${repo.name} is paused.`, 409);
    }
    return repo;
  }

  const repoId = await store.getActiveRepoId(userId);
  if (!repoId) {
    throw new RepoCommandError(formatNoProductRepoSelected(), 409);
  }
  const repo = await store.getRepo(repoId);
  if (!repo) {
    throw new RepoCommandError(`Active repo not found: ${repoId}`, 404);
  }
  if (isControllerSystemRepo(repo)) {
    throw new RepoCommandError(formatNoProductRepoSelected(), 409);
  }
  if (repo.isPaused) {
    throw new RepoCommandError(`Repo ${repo.name} is paused.`, 409);
  }
  return repo;
}

function formatRepoList(repos: RepoRegistration[], activeRepoId: string | undefined): string {
  if (repos.length === 0) {
    return formatNoProductRepoSelected();
  }
  const rows = repos
    .map((repo) => {
      const marker = repo.id === activeRepoId ? "*" : "-";
      const role = isControllerSystemRepo(repo) ? "system/controller" : repo.isPaused ? "paused" : "product";
      return `${marker} ${repo.name} (${role}) ${repo.repoPath}`;
    })
    .join("\n");
  return `${rows}\nProduct setup: /repo clone <alias> <git-url> [absolute-project-path], /repo use <alias>, /repo github-setup <alias>.`;
}

function formatNoProductRepoSelected(): string {
  return [
    "No product repo is selected.",
    "Auto Forge Controller is the deployed automation harness, not the default work target.",
    "Register a product repo from Telegram:",
    "/repo clone <alias> <git-url> /data/repos/<alias>",
    "/repo use <alias>",
    "/repo github-setup <alias>",
    "Then run /scope @<alias> <project framing or task>."
  ].join("\n");
}

function formatControllerRepoRefusal(alias: string): string {
  return [
    `${alias} is the controller system repo, so it is not selectable as the default product target.`,
    "Register and select a product repo instead:",
    "/repo clone <alias> <git-url> /data/repos/<alias>",
    "/repo use <alias>",
    "Use an explicit controller-maintenance workflow only when you intentionally want Auto Forge to edit itself."
  ].join("\n");
}

function formatGitHubOnboardingPlan(repo: RepoRegistration, blocker?: string): string {
  const lines = [
    blocker ? `GitHub push readiness is blocked for ${repo.name}: ${blocker}` : `GitHub push setup for ${repo.name}`,
    "1. Run /repo key create <alias> if this repo does not have a controller deploy key yet.",
    "2. Add the shown public key in GitHub: Repository Settings -> Deploy keys -> Add deploy key.",
    "3. Enable write access on that deploy key so Auto Forge can push commits.",
    "4. If AUTO_FORGE_GITHUB_TOKEN is configured on the server, you can instead run /repo key github-add <alias> --write.",
    "5. Run /repo git-test <alias> to verify SSH read access and a write dry-run before using /scope.",
    "Secrets stay on the server: Telegram will show public keys and fingerprints only, never private keys or tokens."
  ];
  return lines.map((line) => line.replace(/<alias>/g, repo.name)).join("\n");
}

async function activeRepoIdOrDefault(store: WorkflowStore, userId: string): Promise<string> {
  return (await store.getActiveRepoId(userId)) ?? "default-repo";
}

async function requireRepoByAlias(store: WorkflowStore, alias: string): Promise<RepoRegistration> {
  const repo = await store.findRepoByName(alias);
  if (!repo) {
    throw new RepoCommandError(`Unknown repo alias: ${alias}`, 404);
  }
  return repo;
}

function requireAlias(value: string | undefined): string {
  if (!value || !/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(value)) {
    throw new RepoCommandError("Repo alias must start with a letter or number and contain only letters, numbers, dashes, or underscores.");
  }
  return value;
}

async function assertRepoAliasAvailable(store: WorkflowStore, alias: string): Promise<void> {
  if (await store.findRepoByName(alias)) {
    throw new RepoCommandError(`Repo alias already exists: ${alias}`, 409);
  }
}

async function saveRegisteredRepo(
  store: WorkflowStore,
  input: { alias: string; repoPath: string; sshRemote?: string }
): Promise<RepoRegistration> {
  const repo: RepoRegistration = {
    id: `repo:${input.alias}`,
    name: input.alias,
    repoPath: input.repoPath,
    defaultBranch: "main",
    sshRemote: input.sshRemote,
    isPaused: false,
    createdAt: new Date()
  };
  await store.saveRepo(repo);
  return repo;
}

async function appendRepoRegistryEvent(
  store: WorkflowStore,
  repo: RepoRegistration,
  userId: string,
  action: RepoRegistrationAction,
  payload: Record<string, unknown>
): Promise<void> {
  await store.appendRepoEvent({
    id: `repo-event:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    repoId: repo.id,
    alias: repo.name,
    userId,
    action,
    payload,
    createdAt: new Date()
  });
}

type RepoRegistrationAction = Parameters<WorkflowStore["appendRepoEvent"]>[0]["action"];

async function assertNoMutatingTask(store: WorkflowStore, repoId: string): Promise<void> {
  const tasks = await store.listTasks();
  const active = tasks.find((task) => task.repoId === repoId && ["worker_running", "qa_running"].includes(task.status));
  if (active) {
    throw new RepoCommandError(`Cannot switch repos while task ${active.id} is mutating ${repoId}.`, 409);
  }
}

async function resolveSafeExistingGitPath(repoPath: string, allowedRoots: string[]): Promise<string> {
  if (!isAbsolute(repoPath)) {
    throw new RepoCommandError("Repo path must be absolute.");
  }
  const safePath = await resolveSafeExistingPath(repoPath, allowedRoots);
  await assertGitWorkTree(safePath);
  return safePath;
}

async function resolveSafeExistingPath(targetPath: string, allowedRoots: string[]): Promise<string> {
  const safeRoots = await resolveAllowedRoots(allowedRoots);
  const safePath = await realpath(targetPath).catch(() => {
    throw new RepoCommandError(`Repo path does not exist: ${targetPath}`, 404);
  });
  if (!safeRoots.some((root) => isPathInside(root, safePath))) {
    throw new RepoCommandError(`Repo path must stay under one of: ${safeRoots.join(", ")}`, 400);
  }
  return safePath;
}

async function resolveAllowedRoots(allowedRoots: string[]): Promise<string[]> {
  const roots = allowedRoots.length > 0 ? allowedRoots : ["/opt/auto-forge-repos"];
  return Promise.all(
    roots.map(async (root) => {
      if (!isAbsolute(root)) {
        throw new RepoCommandError(`Allowed repo root must be absolute: ${root}`);
      }
      await mkdir(root, { recursive: true });
      return realpath(root);
    })
  );
}

function isPathInside(root: string, targetPath: string): boolean {
  const distance = relative(root, targetPath);
  return distance === "" || (!distance.startsWith("..") && !isAbsolute(distance));
}

async function assertGitWorkTree(repoPath: string): Promise<void> {
  try {
    await execFileAsync("git", ["-C", repoPath, "rev-parse", "--is-inside-work-tree"]);
  } catch {
    throw new RepoCommandError(`Repo path is not a git work tree: ${repoPath}`);
  }
}

async function safeCloneTarget(alias: string, allowedRoots: string[]): Promise<string> {
  const [root] = await resolveAllowedRoots(allowedRoots);
  if (!root) {
    throw new RepoCommandError("No allowed repo roots are configured.");
  }
  const targetPath = join(root, alias);
  const targetParent = await realpath(root);
  if (!isPathInside(targetParent, targetPath)) {
    throw new RepoCommandError("Clone target escaped the allowed repo root.");
  }
  return targetPath;
}

async function safeCloneTargetPath(targetPath: string, allowedRoots: string[]): Promise<string> {
  if (!isAbsolute(targetPath)) {
    throw new RepoCommandError("Clone target path must be absolute.");
  }
  const safeRoots = await resolveAllowedRoots(allowedRoots);
  const parentPath = await realpath(dirname(targetPath)).catch(() => {
    throw new RepoCommandError(`Clone target parent does not exist: ${dirname(targetPath)}`, 404);
  });
  const resolvedTarget = resolvePath(parentPath, basename(targetPath));
  if (!safeRoots.some((root) => isPathInside(root, resolvedTarget))) {
    throw new RepoCommandError(`Clone target path must stay under one of: ${safeRoots.join(", ")}`, 400);
  }
  if (await exists(resolvedTarget)) {
    throw new RepoCommandError(`Clone target already exists: ${resolvedTarget}`, 409);
  }
  return resolvedTarget;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isControllerSystemRepo(repo: RepoRegistration): boolean {
  if (repo.id !== "default-repo") {
    return false;
  }
  const configuredName = process.env.AUTO_FORGE_REPO_NAME ?? "auto-forge-controller";
  const configuredPath = process.env.AUTO_FORGE_REPO_PATH;
  return repo.name === configuredName || (configuredPath !== undefined && repo.repoPath === configuredPath);
}

function validateGitUrl(gitUrl: string): void {
  if (!/^(https:\/\/|ssh:\/\/|git@|file:\/\/)/i.test(gitUrl)) {
    throw new RepoCommandError("Repo clone URL must use https://, ssh://, git@, or file://.");
  }
}

async function cloneGitRepo(gitUrl: string, targetPath: string): Promise<void> {
  try {
    await execFileAsync("git", ["clone", "--", gitUrl, targetPath]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "git clone failed";
    throw new RepoCommandError(message, 502);
  }
}

export async function validateSetup(
  setup: ControllerSetup,
  dependencies: Pick<SetupDependencies, "openClaw" | "telegram">,
  options: { requireOpenClawTelegramDelivery?: boolean } = {}
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

    if (options.requireOpenClawTelegramDelivery) {
      await captureCheck(checks, "openclaw_telegram_outbound", async () => {
        await dependencies.openClaw.sendTelegramStatus(
          setup.openClaw,
          setup.telegram.testChatId,
          "Auto Forge Controller OpenClaw routed setup check passed."
        );
        return "OpenClaw routed Telegram delivery accepted";
      });
    } else {
      try {
        await dependencies.openClaw.sendTelegramStatus(
          setup.openClaw,
          setup.telegram.testChatId,
          "Auto Forge Controller OpenClaw routed setup check passed."
        );
        checks.push({
          name: "openclaw_telegram_outbound",
          status: "passed",
          message: "OpenClaw routed Telegram delivery accepted"
        });
      } catch (error) {
        checks.push({
          name: "openclaw_telegram_outbound",
          status: "skipped",
          message: `Optional OpenClaw routed Telegram delivery did not pass: ${error instanceof Error ? error.message : "unknown error"}. Direct Telegram delivery passed, and controller Telegram replies do not depend on OpenClaw CLI delivery.`
        });
      }
    }
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
      mode: setup.openClaw.mode,
      authRef: setup.openClaw.authRef ?? setup.openClaw.tokenRef,
      tokenRef: setup.openClaw.tokenRef,
      agentHookPath,
      discovery: setup.openClaw.discovery
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
