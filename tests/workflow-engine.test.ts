import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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

  it("resolves relative brief paths inside the product repo instead of controller cwd", async () => {
    const repoPath = await createGitRepo();
    const briefPath = `.auto-forge/test-brief-${Date.now()}`;
    await writeCanonicalBriefArtifacts(join(process.cwd(), briefPath), "BLOCKED_EXTERNAL");
    await writeCanonicalBriefArtifacts(join(repoPath, briefPath), "CLEAR_CURRENT_PHASE");
    const harness = await buildHarness(
      [
        { status: "succeeded" },
        { status: "succeeded" },
        { status: "succeeded" },
        { status: "succeeded" }
      ],
      { repoPath, briefPath }
    );

    const task = await harness.engine.handleScopeCommand({
      repoId: "repo-1",
      requestedByUserId: "user-1",
      title: "Product brief wins"
    });

    expect(task.status).toBe("completed");
  });

  it("reports local QA passed with push pending instead of a generic QA block", async () => {
    const repoPath = await createGitRepo();
    const briefPath = join(repoPath, "artifacts", "id-1", "qa");
    await writeQaCheckpointArtifacts(briefPath);
    const harness = await buildHarness(
      [
        { status: "succeeded" },
        { status: "succeeded" },
        { status: "succeeded" },
        { status: "succeeded" }
      ],
      { repoPath, briefPath }
    );

    const task = await harness.engine.handleScopeCommand({
      repoId: "repo-1",
      requestedByUserId: "user-1",
      title: "Push pending"
    });

    expect(task.status).toBe("blocked");
    expect(task.blockedReason).toContain("local QA passed");
    expect(task.blockedReason).toContain("GitHub push requires credentials");
    expect(task.blockedReason).not.toBe("QA blocked the task.");
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

  it("retries a blocked task through a fresh scope-to-QA run", async () => {
    const harness = await buildHarness([
      { status: "succeeded" },
      { status: "succeeded" },
      { status: "blocked", blockerReason: "GitHub push requires credentials" },
      { status: "succeeded" },
      { status: "succeeded" },
      { status: "succeeded" },
      { status: "succeeded", signals: [{ type: "qa_outcome", outcome: "clear" }] }
    ]);

    const blocked = await harness.engine.handleScopeCommand({
      repoId: "repo-1",
      requestedByUserId: "user-1",
      title: "Retryable task"
    });
    const retried = await harness.engine.retryTask(blocked.id, "Credentials configured");
    const events = await harness.store.listEvents(blocked.id);

    expect(blocked.status).toBe("blocked");
    expect(retried.id).toBe(blocked.id);
    expect(retried.status).toBe("completed");
    expect(retried.blockedReason).toBeUndefined();
    expect(harness.runner.requests.map((request) => request.role)).toEqual([
      "scope",
      "planner",
      "worker",
      "scope",
      "planner",
      "worker",
      "qa"
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({
        eventType: "task_retry_requested",
        payload: expect.objectContaining({ previousBlockedReason: "GitHub push requires credentials" })
      })
    );
  });

  it("retries only publish when canonical clear-QA artifacts show a failed push", async () => {
    const { repoPath, artifactRoot } = await createPublishRetryFixture({ remote: "valid" });
    const harness = await buildHarness([], { repoPath, briefPath: artifactRoot });
    const blocked = await saveBlockedTask(harness.store, "GitHub push failed after local QA passed");

    const retried = await harness.engine.retryTask(blocked.id, "Deploy key fixed");
    const events = await harness.store.listEvents(blocked.id);
    const qa = JSON.parse(await readFile(join(artifactRoot, "automation", "qa.json"), "utf8")) as Record<string, unknown>;

    expect(retried.status).toBe("completed");
    expect(retried.blockedReason).toBeUndefined();
    expect(harness.runner.requests).toHaveLength(0);
    expect(events.map((event) => event.eventType)).toEqual([
      "task_retry_requested",
      "publish_retry_started",
      "publish_retry_succeeded",
      "task_completed"
    ]);
    expect(qa.push_status).toBe("pushed to origin/main");
    expect(qa.human_input_required).toBe(false);
    expect(harness.gateway.statusMessages.at(-1)?.text).toBe("Completed: local QA passed and GitHub push succeeded.");
  });

  it("keeps publish retry blocked with exact git output when push fails", async () => {
    const { repoPath, artifactRoot } = await createPublishRetryFixture({ remote: "invalid" });
    const harness = await buildHarness([], { repoPath, briefPath: artifactRoot });
    const blocked = await saveBlockedTask(harness.store, "GitHub push failed after local QA passed");

    const retried = await harness.engine.retryTask(blocked.id, "Deploy key fixed");
    const events = await harness.store.listEvents(blocked.id);

    expect(retried.status).toBe("blocked");
    expect(retried.blockedReason).toContain("local QA passed, but GitHub push retry failed.");
    expect(retried.blockedReason).toContain("stdout:");
    expect(retried.blockedReason).toContain("stderr:");
    expect(retried.blockedReason).toContain("/repo github-setup repo");
    expect(retried.blockedReason).toContain("/repo git-test repo");
    expect(harness.runner.requests).toHaveLength(0);
    expect(events.map((event) => event.eventType)).toEqual([
      "task_retry_requested",
      "publish_retry_started",
      "publish_retry_failed"
    ]);
  });

  it("refuses publish-only retry when the tree is dirty", async () => {
    const { repoPath, artifactRoot } = await createPublishRetryFixture({ remote: "valid" });
    await writeFile(join(repoPath, "dirty.txt"), "dirty\n");
    const harness = await buildHarness([], { repoPath, briefPath: artifactRoot });
    const blocked = await saveBlockedTask(harness.store, "GitHub push failed after local QA passed");

    const retried = await harness.engine.retryTask(blocked.id, "Deploy key fixed");

    expect(retried.status).toBe("blocked");
    expect(retried.blockedReason).toContain("Publish retry refused: working tree is dirty");
    expect(harness.runner.requests).toHaveLength(0);
  });

  it("refuses publish-only retry when HEAD differs from the canonical stop report SHA", async () => {
    const { repoPath, artifactRoot, headSha } = await createPublishRetryFixture({ remote: "valid" });
    await writeFile(join(repoPath, "new-head.txt"), "new head\n");
    await execFileAsync("git", ["add", "new-head.txt"], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "Move head"], { cwd: repoPath });
    const harness = await buildHarness([], { repoPath, briefPath: artifactRoot });
    const blocked = await saveBlockedTask(harness.store, "GitHub push failed after local QA passed");

    const retried = await harness.engine.retryTask(blocked.id, "Deploy key fixed");

    expect(retried.status).toBe("blocked");
    expect(retried.blockedReason).toContain(`expected stop report commit ${headSha}`);
    expect(harness.runner.requests).toHaveLength(0);
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

async function createPublishRetryFixture(options: { remote: "valid" | "invalid" }): Promise<{
  repoPath: string;
  artifactRoot: string;
  headSha: string;
}> {
  const repoPath = await createGitRepo();
  if (options.remote === "valid") {
    const remotePath = await mkdtemp(join(tmpdir(), "auto-forge-workflow-remote-"));
    await execFileAsync("git", ["init", "--bare"], { cwd: remotePath });
    await execFileAsync("git", ["remote", "add", "origin", remotePath], { cwd: repoPath });
  } else {
    await execFileAsync("git", ["remote", "add", "origin", join(repoPath, "missing-remote.git")], { cwd: repoPath });
  }
  const headSha = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repoPath })).stdout.trim();
  const artifactRoot = await mkdtemp(join(tmpdir(), "auto-forge-publish-artifacts-"));
  await writePublishRetryArtifacts(artifactRoot, headSha);
  return { repoPath, artifactRoot, headSha };
}

async function writePublishRetryArtifacts(artifactRoot: string, headSha: string): Promise<void> {
  await mkdir(join(artifactRoot, "reports"), { recursive: true });
  await mkdir(join(artifactRoot, "automation"), { recursive: true });
  const base = {
    brief_id: "publish-retry-fixture",
    updated_at: "2026-04-30T00:00:00Z",
    implementation_commit_sha: headSha,
    stop_report_commit_sha: headSha
  };
  await writeFile(join(artifactRoot, "reports", "LATEST.md"), "# Latest\n");
  await writeFile(join(artifactRoot, "reports", "LATEST.json"), `${JSON.stringify({ ...base, push_status: "failed: auth denied" }, null, 2)}\n`);
  await writeFile(join(artifactRoot, "automation", "state.json"), `${JSON.stringify({ ...base, status: "QA_CHECKPOINT" }, null, 2)}\n`);
  await writeFile(
    join(artifactRoot, "automation", "qa.json"),
    `${JSON.stringify(
      {
        ...base,
        qa_status: "CLEAR_CURRENT_PHASE",
        push_status: "failed: auth denied",
        human_input_required: true
      },
      null,
      2
    )}\n`
  );
}

async function saveBlockedTask(store: MemoryWorkflowStore, blockedReason: string) {
  const task = {
    id: "task-publish-retry",
    repoId: "repo-1",
    requestedByUserId: "user-1",
    title: "Publish retry task",
    kind: "scope" as const,
    status: "blocked" as const,
    blockedReason,
    createdAt: new Date("2026-04-28T00:00:00Z"),
    updatedAt: new Date("2026-04-28T00:00:00Z")
  };
  await store.saveTask(task);
  return task;
}

async function writeCanonicalBriefArtifacts(
  artifactRoot: string,
  qaStatus: "CLEAR_CURRENT_PHASE" | "BLOCKED_EXTERNAL"
): Promise<void> {
  await mkdir(join(artifactRoot, "reports"), { recursive: true });
  await mkdir(join(artifactRoot, "automation"), { recursive: true });
  const base = {
    brief_id: "fixture",
    updated_at: "2026-04-30T00:00:00Z",
    implementation_commit_sha: "1111111111111111111111111111111111111111",
    stop_report_commit_sha: "2222222222222222222222222222222222222222"
  };
  await writeFile(join(artifactRoot, "reports", "LATEST.md"), "# Latest\n");
  await writeFile(join(artifactRoot, "reports", "LATEST.json"), `${JSON.stringify(base, null, 2)}\n`);
  await writeFile(join(artifactRoot, "automation", "state.json"), `${JSON.stringify({ ...base, status: "QA_CHECKPOINT" }, null, 2)}\n`);
  await writeFile(join(artifactRoot, "automation", "qa.json"), `${JSON.stringify({ ...base, qa_status: qaStatus }, null, 2)}\n`);
}

async function writeQaCheckpointArtifacts(artifactRoot: string): Promise<void> {
  await mkdir(join(artifactRoot, "reports"), { recursive: true });
  await mkdir(join(artifactRoot, "automation"), { recursive: true });
  await writeFile(join(artifactRoot, "reports", "qa-stop.md"), "# QA passed, push pending\n");
  await writeFile(
    join(artifactRoot, "automation", "qa-checkpoint.json"),
    `${JSON.stringify(
      {
        qa: { gate: "npm run qa", status: "passed" },
        humanInputRequired: true,
        openRisks: ["GitHub push requires credentials or an alternate authenticated remote."]
      },
      null,
      2
    )}\n`
  );
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
