import { describe, expect, it } from "vitest";
import { createForgeTask, transitionTask } from "../packages/core/src/index.js";

describe("task state machine", () => {
  it("creates, queues, waits for approval, resumes, and completes a task", () => {
    let task = createForgeTask({
      id: "task-1",
      repoId: "repo-1",
      requestedByUserId: "user-1",
      title: "Ship workflow"
    });

    expect(task.status).toBe("created");

    task = transitionTask(task, { type: "enqueue" });
    expect(task.status).toBe("queued");

    task = transitionTask(task, { type: "start_scope", runId: "run-1" });
    expect(task.status).toBe("scope_running");

    task = transitionTask(task, { type: "request_approval", approvalId: "approval-1" });
    expect(task.status).toBe("waiting_approval");
    expect(task.pendingApprovalId).toBe("approval-1");

    task = transitionTask(task, { type: "approve", runId: "run-2" });
    expect(task.status).toBe("worker_running");
    expect(task.pendingApprovalId).toBeUndefined();

    task = transitionTask(task, { type: "complete" });
    expect(task.status).toBe("completed");
  });

  it("blocks and cancels non-terminal tasks", () => {
    const task = transitionTask(
      createForgeTask({ id: "task-2", repoId: "repo-1", requestedByUserId: "user-1", title: "Blocked task" }),
      { type: "enqueue" }
    );

    const blocked = transitionTask(task, { type: "block", reason: "waiting for credentials" });
    expect(blocked.status).toBe("blocked");
    expect(blocked.blockedReason).toBe("waiting for credentials");

    const cancelled = transitionTask(blocked, { type: "cancel" });
    expect(cancelled.status).toBe("cancelled");
  });

  it("rejects invalid transitions", () => {
    const task = createForgeTask({ id: "task-3", repoId: "repo-1", requestedByUserId: "user-1", title: "Invalid" });
    expect(() => transitionTask(task, { type: "complete" })).toThrow(/Invalid task transition/);
  });
});
