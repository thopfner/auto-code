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
import { MemorySetupStore, MemoryWorkflowStore } from "../packages/core/src/index.js";

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
});
