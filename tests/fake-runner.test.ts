import { describe, expect, it } from "vitest";
import { FakeForgeRunner, FakeOperatorGateway } from "../packages/adapters/src/index.js";
import type { RunnerProfile } from "../packages/core/src/index.js";

const profile: RunnerProfile = {
  id: "profile-1",
  name: "fake worker",
  role: "worker",
  codexAuthRef: "env:OPENAI_API_KEY",
  createdAt: new Date("2026-04-28T00:00:00Z")
};

describe("fake runner adapter", () => {
  it("records a successful role-specific run", async () => {
    const runner = new FakeForgeRunner();
    const result = await runner.run({
      taskId: "task-1",
      repoId: "repo-1",
      role: "worker",
      profile,
      promptPath: "brief.md",
      artifactDir: "artifacts/task-1"
    });

    expect(result.status).toBe("succeeded");
    expect(result.runId).toBe("fake-worker-1");
    expect(result.artifacts).toContain("artifacts/task-1/reports/LATEST.md");
    expect(runner.requests).toHaveLength(1);
  });

  it("represents blocked runner outcomes", async () => {
    const runner = new FakeForgeRunner("block");
    const result = await runner.run({
      taskId: "task-1",
      repoId: "repo-1",
      role: "qa",
      profile: { ...profile, role: "qa" },
      promptPath: "qa.md",
      artifactDir: "artifacts/task-1"
    });

    expect(result.status).toBe("blocked");
    expect(result.blockerReason).toBe("fake external blocker");
  });
});

describe("fake operator gateway", () => {
  it("captures status and approval messages without external services", async () => {
    const gateway = new FakeOperatorGateway();
    await gateway.sendStatus({ userId: "user-1", text: "Queued" });
    await gateway.sendApprovalRequest({ userId: "user-1", text: "Approve plan?", approvalId: "approval-1" });

    expect(gateway.statusMessages).toHaveLength(1);
    expect(gateway.approvalRequests[0]?.approvalId).toBe("approval-1");
  });
});
