import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { buildServer } from "../apps/api/src/server.js";
import {
  FakeForgeRunner,
  FakeOpenClawSetupAdapter,
  FakeOperatorGateway,
  FakeTelegramSetupAdapter
} from "../packages/adapters/src/index.js";
import { MemorySetupStore, MemoryWorkflowStore, type ControllerSetup } from "../packages/core/src/index.js";

const execFileAsync = promisify(execFile);

const controllerSetup: ControllerSetup = {
  configuredByUserId: "test",
  updatedAt: "2026-04-29T00:00:00.000Z",
  openClaw: {
    baseUrl: "http://localhost:18789",
    mode: "detect-existing",
    agentHookPath: "/hooks/agent"
  },
  telegram: {
    botTokenRef: "env:TELEGRAM_BOT_TOKEN",
    testChatId: "7375937847",
    registerCommands: true,
    sendTestMessage: true,
    commands: ["scope", "status", "queue"]
  }
};

describe("Telegram workflow API", () => {
  it("manages registered repos through Telegram commands", async () => {
    const allowedRoot = await mkdtemp(join(tmpdir(), "auto-forge-repos-"));
    const repoPath = join(allowedRoot, "registered");
    await initGitRepo(repoPath);
    const workflowStore = new MemoryWorkflowStore();
    const server = buildServer({
      setupStore: new MemorySetupStore(),
      telegram: new FakeTelegramSetupAdapter(),
      openClaw: new FakeOpenClawSetupAdapter(),
      workflowStore,
      operator: new FakeOperatorGateway(),
      runner: new FakeForgeRunner([]),
      repoRegistry: { allowedRoots: [allowedRoot] }
    });

    const add = await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: `/repo add-path app ${repoPath}` }
    });
    expect(add.statusCode).toBe(201);
    expect(add.json().repo).toEqual(expect.objectContaining({ name: "app", repoPath }));

    const list = await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: "/repos" }
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().message).toContain("app");

    const use = await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: "/repo use app" }
    });
    expect(use.statusCode).toBe(200);
    expect(use.json().activeRepoId).toBe("repo:app");

    const pause = await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: "/repo pause app" }
    });
    expect(pause.statusCode).toBe(200);
    expect(pause.json().repo.isPaused).toBe(true);

    const resume = await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: "/repo resume app" }
    });
    expect(resume.statusCode).toBe(200);
    expect(resume.json().repo.isPaused).toBe(false);
    await expect(workflowStore.listRepoEvents("repo:app")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "add_path" }),
        expect.objectContaining({ action: "use" }),
        expect.objectContaining({ action: "pause" }),
        expect.objectContaining({ action: "resume" })
      ])
    );
  });

  it("clones repos only into the configured allowed root", async () => {
    const allowedRoot = await mkdtemp(join(tmpdir(), "auto-forge-clone-root-"));
    const sourceRepo = await mkdtemp(join(tmpdir(), "auto-forge-clone-source-"));
    await execFileAsync("git", ["init", "--bare", sourceRepo]);
    const server = buildServer({
      setupStore: new MemorySetupStore(),
      telegram: new FakeTelegramSetupAdapter(),
      openClaw: new FakeOpenClawSetupAdapter(),
      workflowStore: new MemoryWorkflowStore(),
      operator: new FakeOperatorGateway(),
      runner: new FakeForgeRunner([]),
      repoRegistry: { allowedRoots: [allowedRoot] }
    });

    const response = await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: `/repo clone cloned ${pathToFileURL(sourceRepo).toString()}` }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().repo).toEqual(
      expect.objectContaining({
        name: "cloned",
        repoPath: join(allowedRoot, "cloned"),
        sshRemote: pathToFileURL(sourceRepo).toString()
      })
    );
  });

  it("rejects path traversal and symlink escapes for repo add-path", async () => {
    const allowedRoot = await mkdtemp(join(tmpdir(), "auto-forge-safe-root-"));
    const outsideRoot = await mkdtemp(join(tmpdir(), "auto-forge-outside-root-"));
    const outsideRepo = join(outsideRoot, "outside");
    await initGitRepo(outsideRepo);
    const escapedLink = join(allowedRoot, "escaped");
    await symlink(outsideRepo, escapedLink);
    const server = buildServer({
      setupStore: new MemorySetupStore(),
      telegram: new FakeTelegramSetupAdapter(),
      openClaw: new FakeOpenClawSetupAdapter(),
      workflowStore: new MemoryWorkflowStore(),
      operator: new FakeOperatorGateway(),
      runner: new FakeForgeRunner([]),
      repoRegistry: { allowedRoots: [allowedRoot] }
    });

    const outside = await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: `/repo add-path outside ${outsideRepo}` }
    });
    expect(outside.statusCode).toBe(400);
    expect(outside.json().error).toContain("must stay under");

    const symlinkEscape = await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: `/repo add-path escaped ${escapedLink}` }
    });
    expect(symlinkEscape.statusCode).toBe(400);
    expect(symlinkEscape.json().error).toContain("must stay under");
  });

  it("rejects repo switching while the current repo has a mutating task", async () => {
    const allowedRoot = await mkdtemp(join(tmpdir(), "auto-forge-switch-root-"));
    const nextRepoPath = join(allowedRoot, "next");
    await initGitRepo(nextRepoPath);
    const workflowStore = new MemoryWorkflowStore();
    await workflowStore.saveTask({
      id: "task-mutating",
      repoId: "default-repo",
      requestedByUserId: "telegram-owner",
      title: "Mutating task",
      kind: "worker",
      status: "worker_running",
      createdAt: new Date("2026-04-29T00:00:00Z"),
      updatedAt: new Date("2026-04-29T00:00:00Z")
    });
    const server = buildServer({
      setupStore: new MemorySetupStore(),
      telegram: new FakeTelegramSetupAdapter(),
      openClaw: new FakeOpenClawSetupAdapter(),
      workflowStore,
      operator: new FakeOperatorGateway(),
      runner: new FakeForgeRunner([]),
      repoRegistry: { allowedRoots: [allowedRoot] }
    });
    await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: `/repo add-path next ${nextRepoPath}` }
    });

    const response = await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: "/repo use next" }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toContain("Cannot switch repos while task task-mutating");
  });

  it("routes /scope to the active repo or an explicit @alias", async () => {
    const allowedRoot = await mkdtemp(join(tmpdir(), "auto-forge-scope-root-"));
    const appRepoPath = join(allowedRoot, "app");
    const apiRepoPath = join(allowedRoot, "api");
    await initGitRepo(appRepoPath);
    await initGitRepo(apiRepoPath);
    const runner = new FakeForgeRunner([{ status: "blocked" }, { status: "blocked" }]);
    const server = buildServer({
      setupStore: new MemorySetupStore(),
      telegram: new FakeTelegramSetupAdapter(),
      openClaw: new FakeOpenClawSetupAdapter(),
      workflowStore: new MemoryWorkflowStore(),
      operator: new FakeOperatorGateway(),
      runner,
      repoRegistry: { allowedRoots: [allowedRoot] }
    });
    await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: `/repo add-path app ${appRepoPath}` }
    });
    await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: `/repo add-path api ${apiRepoPath}` }
    });
    await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: "/repo use app" }
    });

    const activeScope = await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: "/scope Ship active repo" }
    });
    const explicitScope = await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: "/scope @api Ship explicit repo" }
    });

    expect(activeScope.statusCode).toBe(202);
    expect(activeScope.json().task.repoId).toBe("repo:app");
    expect(explicitScope.statusCode).toBe(202);
    expect(explicitScope.json().task.repoId).toBe("repo:api");
    expect(runner.requests.map((request) => request.repoPath)).toEqual([appRepoPath, apiRepoPath]);
  });

  it("never returns private SSH key material from Telegram repo key commands", async () => {
    const allowedRoot = await mkdtemp(join(tmpdir(), "auto-forge-key-root-"));
    const keyRoot = await mkdtemp(join(tmpdir(), "auto-forge-api-key-root-"));
    const repoPath = join(allowedRoot, "app");
    await initGitRepo(repoPath);
    await execFileAsync("git", ["-C", repoPath, "remote", "add", "origin", "git@github.com:owner/repo.git"]);
    const server = buildServer({
      setupStore: new MemorySetupStore(),
      telegram: new FakeTelegramSetupAdapter(),
      openClaw: new FakeOpenClawSetupAdapter(),
      workflowStore: new MemoryWorkflowStore(),
      operator: new FakeOperatorGateway(),
      runner: new FakeForgeRunner([]),
      repoRegistry: { allowedRoots: [allowedRoot] },
      repoSshKeys: {
        keyRoot,
        commandRunner: async (invocation) => {
          if (invocation.command === "ssh-keygen" && invocation.args.includes("-f")) {
            const keyPath = invocation.args[invocation.args.indexOf("-f") + 1];
            if (!keyPath) {
              throw new Error("missing key path");
            }
            await mkdir(dirname(keyPath), { recursive: true, mode: 0o700 });
            await writeFile(keyPath, "-----BEGIN OPENSSH PRIVATE KEY-----\nsecret-private-key\n-----END OPENSSH PRIVATE KEY-----\n");
            await writeFile(`${keyPath}.pub`, "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITestKey auto-forge\n");
            await chmod(keyPath, 0o600);
            return { stdout: "", stderr: "" };
          }
          if (invocation.command === "ssh-keygen" && invocation.args.includes("-lf")) {
            return { stdout: "256 SHA256:testfingerprint auto-forge (ED25519)\n", stderr: "" };
          }
          throw new Error(
            "git failed\n-----BEGIN OPENSSH PRIVATE KEY-----\nsecret-private-key\n-----END OPENSSH PRIVATE KEY-----"
          );
        }
      }
    });
    await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: `/repo add-path app ${repoPath}` }
    });

    const create = await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: "/repo key create app" }
    });
    const test = await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: "/repo key test app" }
    });

    expect(create.statusCode).toBe(201);
    expect(create.json().message).toContain("Public key:");
    expect(create.body).not.toContain("OPENSSH PRIVATE KEY");
    expect(create.body).not.toContain("secret-private-key");
    expect(test.statusCode).toBe(502);
    expect(test.body).toContain("[REDACTED_PRIVATE_KEY]");
    expect(test.body).not.toContain("secret-private-key");
  });

  it("defaults OAuth-backed Telegram command profiles to the Codex CLI account model", async () => {
    const previousAuthRef = process.env.CODEX_AUTH_REF;
    const previousModel = process.env.AUTO_FORGE_CODEX_MODEL;
    process.env.CODEX_AUTH_REF = "secret:codex-oauth-local-cache";
    delete process.env.AUTO_FORGE_CODEX_MODEL;
    try {
      const runner = new FakeForgeRunner([{ status: "blocked" }]);
      const tempRoot = await mkdtemp(join(tmpdir(), "auto-forge-api-oauth-profile-"));
      const server = buildServer({
        setupStore: new MemorySetupStore(),
        telegram: new FakeTelegramSetupAdapter(),
        openClaw: new FakeOpenClawSetupAdapter(),
        workflowStore: new MemoryWorkflowStore(),
        operator: new FakeOperatorGateway(),
        runner,
        workflowOptions: {
          briefPath: tempRoot,
          artifactRoot: join(tempRoot, "artifacts"),
          promptRoot: join(tempRoot, "prompts")
        }
      });

      const response = await server.inject({
        method: "POST",
        url: "/telegram/command",
        payload: { text: "/scope Ship the workflow" }
      });

      expect(response.statusCode).toBe(202);
      expect(runner.requests[0]?.profile).toEqual(
        expect.objectContaining({
          codexAuthRef: "secret:codex-oauth-local-cache",
          model: undefined
        })
      );
    } finally {
      if (previousAuthRef === undefined) {
        delete process.env.CODEX_AUTH_REF;
      } else {
        process.env.CODEX_AUTH_REF = previousAuthRef;
      }
      if (previousModel === undefined) {
        delete process.env.AUTO_FORGE_CODEX_MODEL;
      } else {
        process.env.AUTO_FORGE_CODEX_MODEL = previousModel;
      }
    }
  });

  it("passes an explicitly configured Codex model into Telegram command profiles", async () => {
    const previousAuthRef = process.env.CODEX_AUTH_REF;
    const previousModel = process.env.AUTO_FORGE_CODEX_MODEL;
    process.env.CODEX_AUTH_REF = "secret:codex-oauth-local-cache";
    process.env.AUTO_FORGE_CODEX_MODEL = "gpt-5.5";
    try {
      const runner = new FakeForgeRunner([{ status: "blocked" }]);
      const tempRoot = await mkdtemp(join(tmpdir(), "auto-forge-api-explicit-model-"));
      const server = buildServer({
        setupStore: new MemorySetupStore(),
        telegram: new FakeTelegramSetupAdapter(),
        openClaw: new FakeOpenClawSetupAdapter(),
        workflowStore: new MemoryWorkflowStore(),
        operator: new FakeOperatorGateway(),
        runner,
        workflowOptions: {
          briefPath: tempRoot,
          artifactRoot: join(tempRoot, "artifacts"),
          promptRoot: join(tempRoot, "prompts")
        }
      });

      const response = await server.inject({
        method: "POST",
        url: "/telegram/command",
        payload: { text: "/scope Ship the workflow" }
      });

      expect(response.statusCode).toBe(202);
      expect(runner.requests[0]?.profile).toEqual(expect.objectContaining({ model: "gpt-5.5" }));
    } finally {
      if (previousAuthRef === undefined) {
        delete process.env.CODEX_AUTH_REF;
      } else {
        process.env.CODEX_AUTH_REF = previousAuthRef;
      }
      if (previousModel === undefined) {
        delete process.env.AUTO_FORGE_CODEX_MODEL;
      } else {
        process.env.AUTO_FORGE_CODEX_MODEL = previousModel;
      }
    }
  });

  it("starts /scope and resumes a clarification approval", async () => {
    const operator = new FakeOperatorGateway();
    const tempRoot = await mkdtemp(join(tmpdir(), "auto-forge-api-workflow-"));
    const server = buildServer({
      setupStore: new MemorySetupStore(),
      telegram: new FakeTelegramSetupAdapter(),
      openClaw: new FakeOpenClawSetupAdapter(),
      workflowStore: new MemoryWorkflowStore(),
      operator,
      runner: new FakeForgeRunner([
        { status: "succeeded", signals: [{ type: "clarification_required", question: "Which target?" }] },
        { status: "succeeded" },
        { status: "succeeded" },
        { status: "succeeded", signals: [{ type: "qa_outcome", outcome: "clear" }] }
      ]),
      workflowOptions: {
        briefPath: tempRoot,
        artifactRoot: join(tempRoot, "artifacts"),
        promptRoot: join(tempRoot, "prompts")
      }
    });

    const start = await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: "/scope Ship the workflow" }
    });

    expect(start.statusCode).toBe(202);
    expect(start.json().task.status).toBe("waiting_approval");
    const approvalId = operator.approvalRequests[0]?.approvalId;
    expect(approvalId).toBeDefined();

    const resume = await server.inject({
      method: "POST",
      url: `/approvals/${approvalId}/respond`,
      payload: { text: "Use the default repo", approved: true }
    });

    expect(resume.statusCode).toBe(200);
    expect(resume.json().task.status).toBe("completed");
  });

  it("marks a stuck task blocked through controller recovery state", async () => {
    const workflowStore = new MemoryWorkflowStore();
    await workflowStore.saveTask({
      id: "task-1",
      repoId: "repo-1",
      requestedByUserId: "user-1",
      title: "Stuck task",
      kind: "worker",
      status: "worker_running",
      createdAt: new Date("2026-04-28T00:00:00Z"),
      updatedAt: new Date("2026-04-28T00:00:00Z")
    });

    const server = buildServer({
      setupStore: new MemorySetupStore(),
      telegram: new FakeTelegramSetupAdapter(),
      openClaw: new FakeOpenClawSetupAdapter(),
      workflowStore,
      operator: new FakeOperatorGateway(),
      runner: new FakeForgeRunner([])
    });

    const response = await server.inject({
      method: "POST",
      url: "/workflow/tasks/task-1/recover",
      payload: { action: "mark-blocked", reason: "Operator recovery smoke" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().task.status).toBe("blocked");
    expect(response.json().task.blockedReason).toBe("Operator recovery smoke");
    await expect(workflowStore.listEvents("task-1")).resolves.toContainEqual(
      expect.objectContaining({ eventType: "operator_recovery_blocked" })
    );
  });

  it("accepts Telegram Bot API webhooks and replies with controller status", async () => {
    const setupStore = new MemorySetupStore();
    await setupStore.write(controllerSetup);
    const telegram = new FakeTelegramSetupAdapter();

    const server = buildServer({
      setupStore,
      telegram,
      openClaw: new FakeOpenClawSetupAdapter(),
      workflowStore: new MemoryWorkflowStore(),
      operator: new FakeOperatorGateway(),
      runner: new FakeForgeRunner([])
    });

    const response = await server.inject({
      method: "POST",
      url: "/telegram/webhook",
      payload: {
        message: {
          text: "/status@HopfnerCoder_bot",
          chat: { id: 7375937847 },
          from: { id: 7375937847 }
        }
      }
    });

    expect(response.statusCode).toBe(200);
    await expect.poll(() => telegram.sentMessages).toEqual([
      { chatId: "7375937847", text: "Auto Forge is running. Active tasks: 0. Total tasks: 0." }
    ]);
  });

  it("acks /scope through direct Telegram delivery even when OpenClaw delivery fails", async () => {
    const setupStore = new MemorySetupStore();
    await setupStore.write(controllerSetup);
    const telegram = new FakeTelegramSetupAdapter();

    const server = buildServer({
      setupStore,
      telegram,
      openClaw: new FakeOpenClawSetupAdapter("fail-delivery"),
      workflowStore: new MemoryWorkflowStore(),
      runner: new FakeForgeRunner([{ status: "failed" }])
    });

    const response = await server.inject({
      method: "POST",
      url: "/telegram/webhook",
      payload: {
        message: {
          text: "/scope Ship the workflow",
          chat: { id: 7375937847 },
          from: { id: 7375937847 }
        }
      }
    });

    expect(response.statusCode).toBe(200);
    await expect.poll(() => telegram.sentMessages[0]).toEqual({
      chatId: "7375937847",
      text: "Queued: Ship the workflow"
    });
  });

  it("rejects Telegram webhook commands from unconfigured chats", async () => {
    const setupStore = new MemorySetupStore();
    await setupStore.write(controllerSetup);
    const telegram = new FakeTelegramSetupAdapter();

    const server = buildServer({
      setupStore,
      telegram,
      openClaw: new FakeOpenClawSetupAdapter(),
      workflowStore: new MemoryWorkflowStore(),
      operator: new FakeOperatorGateway(),
      runner: new FakeForgeRunner([])
    });

    const response = await server.inject({
      method: "POST",
      url: "/telegram/webhook",
      payload: {
        message: {
          text: "/status",
          chat: { id: 111 },
          from: { id: 222 }
        }
      }
    });

    expect(response.statusCode).toBe(200);
    await expect.poll(() => telegram.sentMessages).toEqual([
      { chatId: "111", text: "You are not authorized to use this command." }
    ]);
  });

  it("rejects Telegram webhooks when the registered secret header is missing", async () => {
    const previousSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    process.env.TELEGRAM_WEBHOOK_SECRET = "test-webhook-secret";
    try {
      const setupStore = new MemorySetupStore();
      await setupStore.write(controllerSetup);
      const server = buildServer({
        setupStore,
        telegram: new FakeTelegramSetupAdapter(),
        openClaw: new FakeOpenClawSetupAdapter(),
        workflowStore: new MemoryWorkflowStore(),
        operator: new FakeOperatorGateway(),
        runner: new FakeForgeRunner([])
      });

      const response = await server.inject({
        method: "POST",
        url: "/telegram/webhook",
        payload: {
          message: {
            text: "/status",
            chat: { id: 7375937847 }
          }
        }
      });

      expect(response.statusCode).toBe(401);
    } finally {
      if (previousSecret === undefined) {
        delete process.env.TELEGRAM_WEBHOOK_SECRET;
      } else {
        process.env.TELEGRAM_WEBHOOK_SECRET = previousSecret;
      }
    }
  });
});

async function initGitRepo(repoPath: string): Promise<void> {
  await mkdir(repoPath, { recursive: true });
  await execFileAsync("git", ["init", repoPath]);
}
