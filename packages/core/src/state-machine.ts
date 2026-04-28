import type { EntityId, ForgeTask, TaskKind, TaskStatus } from "./types.js";

export type TaskEvent =
  | { type: "enqueue" }
  | { type: "start_scope"; runId: EntityId }
  | { type: "start_planning"; runId: EntityId }
  | { type: "request_approval"; approvalId: EntityId }
  | { type: "approve"; runId: EntityId; nextStatus?: Extract<TaskStatus, "worker_running" | "qa_running" | "planning"> }
  | { type: "block"; reason: string }
  | { type: "cancel"; reason?: string }
  | { type: "complete" };

export function createForgeTask(input: {
  id: EntityId;
  repoId: EntityId;
  requestedByUserId: EntityId;
  title: string;
  kind?: TaskKind;
  now?: Date;
}): ForgeTask {
  const now = input.now ?? new Date();
  return {
    id: input.id,
    repoId: input.repoId,
    requestedByUserId: input.requestedByUserId,
    title: input.title,
    kind: input.kind ?? "scope",
    status: "created",
    createdAt: now,
    updatedAt: now
  };
}

export function transitionTask(task: ForgeTask, event: TaskEvent, now = new Date()): ForgeTask {
  if (isTerminal(task.status)) {
    throw new Error(`Cannot transition terminal task ${task.id} from ${task.status}`);
  }

  switch (event.type) {
    case "enqueue":
      requireStatus(task, ["created"]);
      return next(task, { status: "queued", updatedAt: now });
    case "start_scope":
      requireStatus(task, ["queued"]);
      return next(task, { status: "scope_running", currentRunId: event.runId, updatedAt: now });
    case "start_planning":
      requireStatus(task, ["queued", "scope_running"]);
      return next(task, { status: "planning", currentRunId: event.runId, updatedAt: now });
    case "request_approval":
      requireStatus(task, ["scope_running", "planning", "qa_running"]);
      return next(task, {
        status: "waiting_approval",
        pendingApprovalId: event.approvalId,
        currentRunId: undefined,
        updatedAt: now
      });
    case "approve":
      requireStatus(task, ["waiting_approval"]);
      return next(task, {
        status: event.nextStatus ?? "worker_running",
        currentRunId: event.runId,
        pendingApprovalId: undefined,
        updatedAt: now
      });
    case "block":
      requireStatus(task, ["created", "queued", "scope_running", "planning", "waiting_approval", "worker_running", "qa_running"]);
      return next(task, { status: "blocked", blockedReason: event.reason, currentRunId: undefined, updatedAt: now });
    case "cancel":
      requireStatus(task, ["created", "queued", "scope_running", "planning", "waiting_approval", "worker_running", "qa_running", "blocked"]);
      return next(task, {
        status: "cancelled",
        blockedReason: event.reason ?? task.blockedReason,
        currentRunId: undefined,
        updatedAt: now
      });
    case "complete":
      requireStatus(task, ["worker_running", "qa_running"]);
      return next(task, { status: "completed", currentRunId: undefined, updatedAt: now });
  }
}

export function isTerminal(status: TaskStatus): boolean {
  return status === "cancelled" || status === "completed";
}

function requireStatus(task: ForgeTask, allowed: TaskStatus[]): void {
  if (!allowed.includes(task.status)) {
    throw new Error(`Invalid task transition from ${task.status}; expected one of ${allowed.join(", ")}`);
  }
}

function next(task: ForgeTask, patch: Partial<ForgeTask>): ForgeTask {
  return { ...task, ...patch };
}
