import type { EntityId, RunnerProfile, RunnerRole } from "./types.js";

export type RunnerSignal =
  | { type: "clarification_required"; question: string }
  | { type: "approval_required"; decisionText: string }
  | { type: "qa_outcome"; outcome: "clear" | "revision" | "replan" | "blocked"; summary?: string };

export interface RunnerRequest {
  taskId: EntityId;
  repoId: EntityId;
  role: RunnerRole;
  profile: RunnerProfile;
  promptPath: string;
  artifactDir: string;
  repoPath?: string;
  attempt?: number;
  resumeText?: string;
}

export interface RunnerResult {
  runId: EntityId;
  status: "succeeded" | "failed" | "blocked";
  exitCode: number;
  logPath: string;
  artifacts: string[];
  blockerReason?: string;
  signals?: RunnerSignal[];
}

export interface ForgeRunner {
  run(request: RunnerRequest): Promise<RunnerResult>;
}

export interface OperatorMessage {
  userId: EntityId;
  text: string;
  buttons?: Array<{ label: string; value: string }>;
}

export interface OperatorGateway {
  sendStatus(message: OperatorMessage): Promise<void>;
  sendApprovalRequest(message: OperatorMessage & { approvalId: EntityId }): Promise<void>;
}
