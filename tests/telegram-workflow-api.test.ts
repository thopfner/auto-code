import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildServer } from "../apps/api/src/server.js";
import {
  FakeForgeRunner,
  FakeOpenClawSetupAdapter,
  FakeOperatorGateway,
  FakeTelegramSetupAdapter
} from "../packages/adapters/src/index.js";
import { MemorySetupStore, MemoryWorkflowStore, type ControllerSetup } from "../packages/core/src/index.js";

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
