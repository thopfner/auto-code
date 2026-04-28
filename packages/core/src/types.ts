export type EntityId = string;

export type TaskStatus =
  | "created"
  | "queued"
  | "scope_running"
  | "planning"
  | "waiting_approval"
  | "worker_running"
  | "qa_running"
  | "blocked"
  | "cancelled"
  | "completed";

export type TaskKind = "scope" | "plan" | "worker" | "qa" | "revision" | "final_closeout";

export type RunnerRole = "scope" | "planner" | "worker" | "qa";

export type SecretRef = `env:${string}` | `secret:${string}`;

export interface User {
  id: EntityId;
  telegramUserId: string;
  displayName: string;
  role: "owner" | "operator" | "viewer";
  createdAt: Date;
}

export interface RepoRegistration {
  id: EntityId;
  name: string;
  repoPath: string;
  defaultBranch: string;
  sshRemote?: string;
  isPaused: boolean;
  createdAt: Date;
}

export interface RunnerProfile {
  id: EntityId;
  name: string;
  role: RunnerRole;
  codexAuthRef: SecretRef;
  model?: string;
  createdAt: Date;
}

export interface Approval {
  id: EntityId;
  taskId: EntityId;
  requestedByRunId: EntityId;
  decisionText: string;
  status: "pending" | "approved" | "rejected";
  decidedByUserId?: EntityId;
  decidedAt?: Date;
}

export interface RunAttempt {
  id: EntityId;
  taskId: EntityId;
  role: RunnerRole;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  startedAt?: Date;
  finishedAt?: Date;
  logPath?: string;
}

export interface ArtifactRecord {
  id: EntityId;
  taskId: EntityId;
  path: string;
  kind: "report" | "automation_state" | "automation_qa" | "git_state" | "log";
  sha256?: string;
  observedAt: Date;
}

export interface RepoLock {
  repoId: EntityId;
  taskId: EntityId;
  acquiredAt: Date;
  reason: "mutating_worker_window" | "qa_checkpoint" | "final_closeout";
}

export interface ForgeTask {
  id: EntityId;
  repoId: EntityId;
  requestedByUserId: EntityId;
  title: string;
  kind: TaskKind;
  status: TaskStatus;
  currentRunId?: EntityId;
  pendingApprovalId?: EntityId;
  blockedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
