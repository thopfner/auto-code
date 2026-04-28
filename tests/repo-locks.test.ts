import { describe, expect, it } from "vitest";
import { RepoLockManager } from "../packages/core/src/index.js";

describe("repo locks", () => {
  it("prevents two mutating windows for the same repo", () => {
    const locks = new RepoLockManager();
    locks.acquire({
      repoId: "repo-1",
      taskId: "task-1",
      acquiredAt: new Date("2026-04-28T00:00:00Z"),
      reason: "mutating_worker_window"
    });

    expect(() =>
      locks.acquire({
        repoId: "repo-1",
        taskId: "task-2",
        acquiredAt: new Date("2026-04-28T00:00:01Z"),
        reason: "mutating_worker_window"
      })
    ).toThrow(/already locked/);
  });

  it("allows the owning task to release its lock", () => {
    const locks = new RepoLockManager();
    locks.acquire({
      repoId: "repo-1",
      taskId: "task-1",
      acquiredAt: new Date("2026-04-28T00:00:00Z"),
      reason: "mutating_worker_window"
    });

    locks.release("repo-1", "task-1");
    expect(locks.current("repo-1")).toBeUndefined();
  });
});
