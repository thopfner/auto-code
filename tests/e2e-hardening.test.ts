import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { buildServer } from "../apps/api/src/server.js";
import {
  FakeForgeRunner,
  FakeOpenClawSetupAdapter,
  FakeOperatorGateway,
  FakeTelegramSetupAdapter
} from "../packages/adapters/src/index.js";
import {
  MemorySetupStore,
  MemoryWorkflowStore,
  validateForgeArtifacts,
  type RepoRegistration,
  type RunnerProfile,
  type RunnerRole,
  type TelegramCommandName
} from "../packages/core/src/index.js";
import { runInstallDocumentationDryRun } from "../packages/ops/src/index.js";

const execFileAsync = promisify(execFile);

describe("Phase 5 end-to-end hardening", () => {
  it("proves fresh install docs, onboarding, /scope, approvals, revision, closeout, summaries, and fixture artifacts", async () => {
    await expect(runInstallDocumentationDryRun()).resolves.toMatchObject({ ok: true });

    const repoPath = await createPushedFixtureRepo();
    const artifactRoot = join(repoPath, "artifacts");
    const workflowStore = new MemoryWorkflowStore();
    await seedWorkflowStore(workflowStore, repoPath);

    const setupStore = new MemorySetupStore();
    const telegram = new FakeTelegramSetupAdapter();
    const openClaw = new FakeOpenClawSetupAdapter();
    const operator = new FakeOperatorGateway();
    const runner = new FakeForgeRunner([
      { status: "succeeded", signals: [{ type: "clarification_required", question: "Confirm fixture repo?" }] },
      { status: "succeeded", signals: [{ type: "approval_required", decisionText: "Approve fixture plan?" }] },
      { status: "succeeded" },
      { status: "succeeded", signals: [{ type: "qa_outcome", outcome: "revision", summary: "Tighten stop report" }] },
      { status: "succeeded" },
      { status: "succeeded", writeForgeArtifacts: { qaStatus: "CLEAR_CURRENT_PHASE" } }
    ]);

    let nextId = 1;
    const server = buildServer({
      setupStore,
      telegram,
      openClaw,
      workflowStore,
      runner,
      operator,
      workflowOptions: {
        artifactRoot,
        briefPath: join(artifactRoot, "id-1", "qa"),
        promptRoot: join(repoPath, "prompts"),
        idFactory: () => `id-${nextId++}`
      }
    });

    const setupResponse = await server.inject({
      method: "POST",
      url: "/setup",
      payload: setupPayload()
    });
    expect(setupResponse.statusCode).toBe(201);
    expect(setupResponse.json()).toMatchObject({ ok: true });
    expect(telegram.registeredCommands[0]).toEqual(["scope", "status", "queue"]);
    expect(telegram.sentMessages).toHaveLength(1);
    expect(openClaw.deliveredMessages).toHaveLength(1);

    const intake = await server.inject({
      method: "POST",
      url: "/telegram/command",
      payload: { text: "/scope Harden fixture lifecycle", userId: "telegram-owner", repoId: "default-repo" }
    });
    expect(intake.statusCode).toBe(202);
    expect(intake.json().task.status).toBe("waiting_approval");

    const clarificationApproval = operator.approvalRequests[0]?.approvalId;
    expect(clarificationApproval).toBeDefined();
    const clarified = await server.inject({
      method: "POST",
      url: `/approvals/${clarificationApproval}/respond`,
      payload: { userId: "telegram-owner", text: "Use the pushed fixture repo", approved: true }
    });
    expect(clarified.statusCode).toBe(200);
    expect(clarified.json().task.status).toBe("waiting_approval");

    const planningApproval = operator.approvalRequests[1]?.approvalId;
    expect(planningApproval).toBeDefined();
    const completed = await server.inject({
      method: "POST",
      url: `/approvals/${planningApproval}/respond`,
      payload: { userId: "telegram-owner", text: "Approved for worker and QA", approved: true }
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().task.status).toBe("completed");

    const tasks = (await server.inject({ method: "GET", url: "/workflow/tasks" })).json().tasks;
    expect(tasks).toContainEqual(expect.objectContaining({ id: "id-1", status: "completed" }));
    expect(runner.requests.map((request) => request.role)).toEqual([
      "scope",
      "planner",
      "worker",
      "qa",
      "worker",
      "qa"
    ]);
    expect(runner.requests[1]?.resumeText).toBe("Use the pushed fixture repo");
    expect(runner.requests[4]?.resumeText).toBe("Tighten stop report");

    const operatorTexts = operator.statusMessages.map((message) => message.text);
    expect(operatorTexts).toContain("Queued Forge task: Harden fixture lifecycle");
    expect(operatorTexts).toContain("QA requested revision: Harden fixture lifecycle");
    expect(operatorTexts).toContain("Completed: Harden fixture lifecycle");

    const events = await workflowStore.listEvents("id-1");
    expect(events.map((event) => event.eventType)).toContain("task_completed");

    const artifacts = await validateForgeArtifacts({
      repoPath,
      artifactRoot: join(artifactRoot, "id-1", "qa"),
      expectedBranch: "main",
      requireCommitShas: true
    });
    expect(artifacts).toMatchObject({ ok: true, qaOutcome: "clear", pushed: true });

    await server.close();
  });
});

async function seedWorkflowStore(store: MemoryWorkflowStore, repoPath: string): Promise<void> {
  const repo: RepoRegistration = {
    id: "default-repo",
    name: "fixture-repo",
    repoPath,
    defaultBranch: "main",
    isPaused: false,
    createdAt: new Date("2026-04-28T00:00:00Z")
  };
  await store.saveRepo(repo);
  await store.saveUser({
    id: "telegram-owner",
    telegramUserId: "1001",
    displayName: "Telegram Owner",
    role: "owner",
    createdAt: new Date("2026-04-28T00:00:00Z")
  });
  for (const role of ["scope", "planner", "worker", "qa"] as RunnerRole[]) {
    await store.saveRunnerProfile(profileFor(role));
  }
}

async function createPushedFixtureRepo(): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), "auto-forge-e2e-"));
  const repoPath = join(parent, "repo");
  const remotePath = join(parent, "remote.git");
  await execFileAsync("git", ["init", "--bare", remotePath]);
  await execFileAsync("git", ["init", "-b", "main", repoPath]);
  await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: repoPath });
  await execFileAsync("git", ["config", "user.name", "Test User"], { cwd: repoPath });
  await writeFile(join(repoPath, "README.md"), "# Fixture Repo\n");
  await execFileAsync("git", ["add", "README.md"], { cwd: repoPath });
  await execFileAsync("git", ["commit", "-m", "Initial fixture commit"], { cwd: repoPath });
  await execFileAsync("git", ["remote", "add", "origin", remotePath], { cwd: repoPath });
  await execFileAsync("git", ["push", "-u", "origin", "main"], { cwd: repoPath });
  return repoPath;
}

function profileFor(role: RunnerRole): RunnerProfile {
  return {
    id: `profile-${role}`,
    name: `${role} profile`,
    role,
    codexAuthRef: "env:OPENAI_API_KEY",
    createdAt: new Date("2026-04-28T00:00:00Z")
  };
}

function setupPayload(): {
  configuredByUserId: string;
  openClaw: { baseUrl: string; tokenRef: "env:OPENCLAW_TOKEN"; agentHookPath: string };
  telegram: {
    botTokenRef: "env:TELEGRAM_BOT_TOKEN";
    testChatId: string;
    registerCommands: boolean;
    sendTestMessage: boolean;
    commands: TelegramCommandName[];
  };
} {
  return {
    configuredByUserId: "telegram-owner",
    openClaw: {
      baseUrl: "https://openclaw.example.test",
      tokenRef: "env:OPENCLAW_TOKEN",
      agentHookPath: "/hooks/agent"
    },
    telegram: {
      botTokenRef: "env:TELEGRAM_BOT_TOKEN",
      testChatId: "-1001234567890",
      registerCommands: true,
      sendTestMessage: true,
      commands: ["scope", "status", "queue"]
    }
  };
}
