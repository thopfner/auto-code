import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { FakeForgeRunner, FakeOperatorGateway, type FakeRunnerStep } from "../packages/adapters/src/index.js";
import {
  ForgeWorkflowEngine,
  MemoryWorkflowStore,
  type RepoRegistration,
  type RunnerProfile,
  type RunnerRole
} from "../packages/core/src/index.js";

const execFileAsync = promisify(execFile);

describe("Forge workflow engine", () => {
  it("runs a fake success workflow from scope through QA clear", async () => {
    const harness = await buildHarness([
      { status: "succeeded" },
      { status: "succeeded" },
      { status: "succeeded" },
      { status: "succeeded", signals: [{ type: "qa_outcome", outcome: "clear" }] }
    ]);

    const task = await harness.engine.handleScopeCommand({
      repoId: "repo-1",
      requestedByUserId: "user-1",
      title: "Ship success"
    });

    expect(task.status).toBe("completed");
    expect(harness.runner.requests.map((request) => request.role)).toEqual(["scope", "planner", "worker", "qa"]);
    expect(harness.gateway.statusMessages.at(-1)?.text).toBe("Completed: Ship success");
  });

  it("pauses for clarification and resumes through Telegram approval handling", async () => {
    const harness = await buildHarness([
      { status: "succeeded", signals: [{ type: "clarification_required", question: "Which repo should change?" }] },
      { status: "succeeded" },
      { status: "succeeded" },
      { status: "succeeded", signals: [{ type: "qa_outcome", outcome: "clear" }] }
    ]);

    const waiting = await harness.engine.handleScopeCommand({
      repoId: "repo-1",
      requestedByUserId: "user-1",
      title: "Needs clarification"
    });
    expect(waiting.status).toBe("waiting_approval");
    const approvalId = harness.gateway.approvalRequests[0]?.approvalId;
    expect(approvalId).toBeDefined();

    const completed = await harness.engine.resumeApproval({
      approvalId: approvalId ?? "",
      userId: "user-1",
      text: "Use repo-1",
      approved: true
    });

    expect(completed.status).toBe("completed");
    expect(harness.runner.requests[1]?.resumeText).toBe("Use repo-1");
  });

  it("pauses for planning approval before worker execution", async () => {
    const harness = await buildHarness([
      { status: "succeeded" },
      { status: "succeeded", signals: [{ type: "approval_required", decisionText: "Approve the plan?" }] },
      { status: "succeeded" },
      { status: "succeeded", signals: [{ type: "qa_outcome", outcome: "clear" }] }
    ]);

    const waiting = await harness.engine.handleScopeCommand({
      repoId: "repo-1",
      requestedByUserId: "user-1",
      title: "Needs approval"
    });
    expect(waiting.status).toBe("waiting_approval");

    const approvalId = harness.gateway.approvalRequests[0]?.approvalId ?? "";
    const completed = await harness.engine.resumeApproval({
      approvalId,
      userId: "user-1",
      text: "Approved",
      approved: true
    });

    expect(completed.status).toBe("completed");
    expect(harness.runner.requests.map((request) => request.role)).toEqual(["scope", "planner", "worker", "qa"]);
  });

  it("routes QA revision back to a worker handoff", async () => {
    const harness = await buildHarness([
      { status: "succeeded" },
      { status: "succeeded" },
      { status: "succeeded" },
      { status: "succeeded", signals: [{ type: "qa_outcome", outcome: "revision", summary: "Fix tests" }] },
      { status: "succeeded" },
      { status: "succeeded", signals: [{ type: "qa_outcome", outcome: "clear" }] }
    ]);

    const task = await harness.engine.handleScopeCommand({
      repoId: "repo-1",
      requestedByUserId: "user-1",
      title: "Revision loop"
    });

    expect(task.status).toBe("completed");
    expect(harness.runner.requests.map((request) => request.role)).toEqual([
      "scope",
      "planner",
      "worker",
      "qa",
      "worker",
      "qa"
    ]);
    expect(harness.runner.requests[4]?.resumeText).toBe("Fix tests");
  });

  it("routes REVISION_PACK_REQUIRED artifacts back to a worker handoff", async () => {
    const repoPath = await createGitRepo();
    const harness = await buildHarness(
      [
        { status: "succeeded" },
        { status: "succeeded" },
        { status: "succeeded" },
        { status: "succeeded", writeForgeArtifacts: { qaStatus: "REVISION_PACK_REQUIRED" } },
        { status: "succeeded" },
        { status: "succeeded", signals: [{ type: "qa_outcome", outcome: "clear" }] }
      ],
      { repoPath, briefPath: join(repoPath, "artifacts", "id-1", "qa") }
    );

    const task = await harness.engine.handleScopeCommand({
      repoId: "repo-1",
      requestedByUserId: "user-1",
      title: "Artifact revision loop"
    });

    expect(task.status).toBe("completed");
    expect(harness.runner.requests.map((request) => request.role)).toEqual([
      "scope",
      "planner",
      "worker",
      "qa",
      "worker",
      "qa"
    ]);
    expect(harness.runner.requests[4]?.resumeText).toBe("QA requested revision.");
  });

  it("blocks artifact-derived QA clear when required commit SHAs are invalid", async () => {
    const repoPath = await createGitRepo();
    const harness = await buildHarness(
      [
        { status: "succeeded" },
        { status: "succeeded" },
        { status: "succeeded" },
        {
          status: "succeeded",
          writeForgeArtifacts: {
            qaStatus: "CLEAR_CURRENT_PHASE",
            implementationCommitSha: "abc123"
          }
        }
      ],
      { repoPath, briefPath: join(repoPath, "artifacts", "id-1", "qa") }
    );

    const task = await harness.engine.handleScopeCommand({
      repoId: "repo-1",
      requestedByUserId: "user-1",
      title: "Invalid artifact SHA"
    });
    const events = await harness.store.listEvents(task.id);

    expect(task.status).toBe("blocked");
    expect(task.blockedReason).toContain("QA artifact validation blocked");
    expect(events.some((event) => event.eventType === "artifact_validation_failed")).toBe(true);
    expect(harness.gateway.statusMessages.at(-1)?.text).toContain("Blocked:");
  });

  it("routes QA blocked outcomes to a blocked task", async () => {
    const harness = await buildHarness([
      { status: "succeeded" },
      { status: "succeeded" },
      { status: "succeeded" },
      { status: "succeeded", signals: [{ type: "qa_outcome", outcome: "blocked", summary: "Missing credentials" }] }
    ]);

    const task = await harness.engine.handleScopeCommand({
      repoId: "repo-1",
      requestedByUserId: "user-1",
      title: "Blocked task"
    });

    expect(task.status).toBe("blocked");
    expect(task.blockedReason).toBe("Missing credentials");
  });

  it("cancels a paused workflow", async () => {
    const harness = await buildHarness([
      { status: "succeeded", signals: [{ type: "clarification_required", question: "Clarify scope" }] }
    ]);

    const waiting = await harness.engine.handleScopeCommand({
      repoId: "repo-1",
      requestedByUserId: "user-1",
      title: "Cancel me"
    });
    const cancelled = await harness.engine.cancelTask(waiting.id, "No longer needed");

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.blockedReason).toBe("No longer needed");
  });

  it("retries a failed role once before continuing", async () => {
    const harness = await buildHarness([
      { status: "succeeded" },
      { status: "succeeded" },
      { status: "failed" },
      { status: "succeeded" },
      { status: "succeeded", signals: [{ type: "qa_outcome", outcome: "clear" }] }
    ]);

    const task = await harness.engine.handleScopeCommand({
      repoId: "repo-1",
      requestedByUserId: "user-1",
      title: "Retry worker"
    });

    expect(task.status).toBe("completed");
    expect(harness.runner.requests.map((request) => request.role)).toEqual([
      "scope",
      "planner",
      "worker",
      "worker",
      "qa"
    ]);
  });

  it("does not retry deterministic blocked runner failures", async () => {
    const harness = await buildHarness([
      { status: "succeeded" },
      { status: "succeeded" },
      { status: "blocked", blockerReason: "Codex runtime path is not writable" }
    ]);

    const task = await harness.engine.handleScopeCommand({
      repoId: "repo-1",
      requestedByUserId: "user-1",
      title: "Blocked worker"
    });

    expect(task.status).toBe("blocked");
    expect(task.blockedReason).toBe("Codex runtime path is not writable");
    expect(harness.runner.requests.map((request) => request.role)).toEqual(["scope", "planner", "worker"]);
    expect(harness.gateway.statusMessages.filter((message) => message.text.startsWith("Starting worker run"))).toHaveLength(1);
  });
});

async function buildHarness(
  steps: FakeRunnerStep[],
  options: { repoPath?: string; briefPath?: string } = {}
) {
  const store = new MemoryWorkflowStore();
  const repoPath = options.repoPath ?? (await mkdtemp(join(tmpdir(), "auto-forge-workflow-")));
  const repo: RepoRegistration = {
    id: "repo-1",
    name: "repo",
    repoPath,
    defaultBranch: "main",
    isPaused: false,
    createdAt: new Date("2026-04-28T00:00:00Z")
  };
  await store.saveRepo(repo);
  await store.saveUser({
    id: "user-1",
    telegramUserId: "1001",
    displayName: "Operator",
    role: "owner",
    createdAt: new Date("2026-04-28T00:00:00Z")
  });
  for (const role of ["scope", "planner", "worker", "qa"] as RunnerRole[]) {
    await store.saveRunnerProfile(profileFor(role));
  }

  const runner = new FakeForgeRunner(steps);
  const gateway = new FakeOperatorGateway();
  let nextId = 1;
  const engine = new ForgeWorkflowEngine(store, runner, gateway, {
    briefPath: options.briefPath ?? repoPath,
    artifactRoot: join(repoPath, "artifacts"),
    promptRoot: join(repoPath, "prompts"),
    idFactory: () => `id-${nextId++}`
  });

  return { engine, runner, gateway, store };
}

async function createGitRepo(): Promise<string> {
  const repoPath = await mkdtemp(join(tmpdir(), "auto-forge-workflow-"));
  await execFileAsync("git", ["init", "-b", "main"], { cwd: repoPath });
  await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: repoPath });
  await execFileAsync("git", ["config", "user.name", "Test User"], { cwd: repoPath });
  await writeFile(join(repoPath, "README.md"), "# Fixture\n");
  await execFileAsync("git", ["add", "README.md"], { cwd: repoPath });
  await execFileAsync("git", ["commit", "-m", "Initial"], { cwd: repoPath });
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
