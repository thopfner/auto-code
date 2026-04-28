import type { EntityId, RunnerProfile, RunnerRole } from "./types.js";

export interface RunnerRequest {
  taskId: EntityId;
  repoId: EntityId;
  role: RunnerRole;
  profile: RunnerProfile;
  promptPath: string;
  artifactDir: string;
}

export interface RunnerResult {
  runId: EntityId;
  status: "succeeded" | "failed" | "blocked";
  exitCode: number;
  logPath: string;
  artifacts: string[];
  blockerReason?: string;
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
