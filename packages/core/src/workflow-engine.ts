import { isAbsolute, join } from "node:path";
import { randomUUID } from "node:crypto";
import { createForgeTask, transitionTask } from "./state-machine.js";
import { RepoLockManager } from "./locks.js";
import { ForgeArtifactWatcher, type QaArtifactOutcome } from "./artifacts.js";
import { ForgePromptBuilder } from "./prompt-builder.js";
import type { ForgeRunner, OperatorGateway, RunnerRequest, RunnerResult, RunnerSignal } from "./runner.js";
import type { Approval, EntityId, ForgeTask, RepoRegistration, RunnerProfile, RunnerRole } from "./types.js";
import type { WorkflowStore } from "./workflow-store.js";

export interface WorkflowEngineOptions {
  briefPath: string;
  artifactRoot?: string;
  promptRoot?: string;
  maxRoleRetries?: number;
  idFactory?: () => EntityId;
}

export interface ScopeCommand {
  repoId: EntityId;
  requestedByUserId: EntityId;
  title: string;
}

export interface ApprovalDecision {
  approvalId: EntityId;
  userId: EntityId;
  text: string;
  approved: boolean;
}

export class ForgeWorkflowEngine {
  private readonly locks = new RepoLockManager();
  private readonly artifactWatcher: ForgeArtifactWatcher;
  private readonly promptBuilder: ForgePromptBuilder;
  private readonly maxRoleRetries: number;
  private readonly idFactory: () => EntityId;

  constructor(
    private readonly store: WorkflowStore,
    private readonly runner: ForgeRunner,
    private readonly operator: OperatorGateway,
    options: WorkflowEngineOptions
  ) {
    this.artifactWatcher = new ForgeArtifactWatcher();
    this.promptBuilder = new ForgePromptBuilder(options.promptRoot);
    this.maxRoleRetries = options.maxRoleRetries ?? 1;
    this.idFactory = options.idFactory ?? (() => randomUUID());
    this.options = options;
  }

  private readonly options: WorkflowEngineOptions;

  async handleScopeCommand(command: ScopeCommand): Promise<ForgeTask> {
    const repo = await this.requireRepo(command.repoId);
    if (repo.isPaused) {
      throw new Error(`Repo ${repo.name} is paused`);
    }

    const task = createForgeTask({
      id: this.idFactory(),
      repoId: command.repoId,
      requestedByUserId: command.requestedByUserId,
      title: command.title
    });
    await this.saveTask(transitionTask(task, { type: "enqueue" }), "task_enqueued", { title: command.title });
    await this.operator.sendStatus({ userId: command.requestedByUserId, text: `Queued Forge task: ${command.title}` });
    return this.runScope((await this.requireTask(task.id)));
  }

  async resumeApproval(decision: ApprovalDecision): Promise<ForgeTask> {
    const approval = await this.store.getApproval(decision.approvalId);
    if (!approval || approval.status !== "pending") {
      throw new Error(`No pending approval found for ${decision.approvalId}`);
    }

    let task = await this.requireTask(approval.taskId);
    const resolved: Approval = {
      ...approval,
      status: decision.approved ? "approved" : "rejected",
      decidedByUserId: decision.userId,
      decidedAt: new Date(),
      responseText: decision.text
    };
    await this.store.saveApproval(resolved);

    if (!decision.approved) {
      task = transitionTask(task, { type: "cancel", reason: decision.text || "Rejected by operator" });
      await this.saveTask(task, "approval_rejected", { approvalId: approval.id });
      await this.operator.sendStatus({ userId: task.requestedByUserId, text: `Task cancelled: ${task.title}` });
      return task;
    }

    await this.store.appendEvent({
      taskId: task.id,
      eventType: "approval_approved",
      payload: { approvalId: approval.id, kind: approval.kind },
      createdAt: new Date()
    });

    if (approval.kind === "clarification") {
      return this.runPlanner(task, decision.text);
    }
    if (approval.kind === "planning") {
      return this.runWorker(task, decision.text);
    }
    return this.runWorker(task, decision.text);
  }

  async cancelTask(taskId: EntityId, reason: string): Promise<ForgeTask> {
    const task = transitionTask(await this.requireTask(taskId), { type: "cancel", reason });
    this.locks.release(task.repoId, task.id);
    await this.saveTask(task, "task_cancelled", { reason });
    await this.operator.sendStatus({ userId: task.requestedByUserId, text: `Cancelled: ${task.title}` });
    return task;
  }

  private async runScope(task: ForgeTask, resumeText?: string): Promise<ForgeTask> {
    const result = await this.runRole(task, "scope", resumeText);
    if (result.status !== "succeeded") {
      return this.blockFromResult(task, result);
    }

    const clarification = firstSignal(result, "clarification_required");
    if (clarification) {
      return this.pauseForApproval(task, "clarification", result.runId, clarification.question, [
        { label: "Reply", value: "reply" },
        { label: "Cancel", value: "cancel" }
      ]);
    }

    return this.runPlanner(await this.requireTask(task.id));
  }

  private async runPlanner(task: ForgeTask, resumeText?: string): Promise<ForgeTask> {
    const result = await this.runRole(task, "planner", resumeText);
    if (result.status !== "succeeded") {
      return this.blockFromResult(task, result);
    }

    const approval = firstSignal(result, "approval_required");
    if (approval) {
      return this.pauseForApproval(task, "planning", result.runId, approval.decisionText, [
        { label: "Approve", value: "approve" },
        { label: "Cancel", value: "cancel" }
      ]);
    }

    return this.runWorker(await this.requireTask(task.id));
  }

  private async runWorker(task: ForgeTask, resumeText?: string): Promise<ForgeTask> {
    this.locks.acquire({
      repoId: task.repoId,
      taskId: task.id,
      acquiredAt: new Date(),
      reason: "mutating_worker_window"
    });

    try {
      const result = await this.runRole(task, "worker", resumeText);
      if (result.status !== "succeeded") {
        return this.blockFromResult(task, result);
      }
      await this.recordArtifacts(task, result);
      return this.runQa(await this.requireTask(task.id));
    } catch (error) {
      this.locks.release(task.repoId, task.id);
      throw error;
    }
  }

  private async runQa(task: ForgeTask): Promise<ForgeTask> {
    const result = await this.runRole(task, "qa");
    if (result.status !== "succeeded") {
      return this.blockFromResult(task, result);
    }

    const outcomeSignal = firstSignal(result, "qa_outcome");
    const artifactOutcome = outcomeSignal ? undefined : await this.outcomeFromArtifacts(task);
    const outcome = outcomeSignal?.outcome ?? artifactOutcome?.outcome ?? "unknown";
    await this.recordArtifacts(task, result);

    if (outcome === "clear") {
      this.locks.release(task.repoId, task.id);
      const completed = transitionTask(await this.requireTask(task.id), { type: "complete" });
      await this.saveTask(completed, "task_completed", {});
      await this.operator.sendStatus({ userId: task.requestedByUserId, text: `Completed: ${task.title}` });
      return completed;
    }

    if (outcome === "revision") {
      await this.operator.sendStatus({ userId: task.requestedByUserId, text: `QA requested revision: ${task.title}` });
      return this.runWorker(await this.requireTask(task.id), outcomeSignal?.summary ?? "QA requested revision.");
    }

    if (outcome === "replan") {
      await this.operator.sendStatus({ userId: task.requestedByUserId, text: `QA requested replan: ${task.title}` });
      return this.runPlanner(await this.requireTask(task.id), outcomeSignal?.summary ?? "QA requested replan.");
    }

    this.locks.release(task.repoId, task.id);
    const reason = outcomeSignal?.summary ?? artifactOutcome?.summary ?? "QA blocked the task.";
    const blocked = transitionTask(await this.requireTask(task.id), { type: "block", reason });
    await this.saveTask(blocked, "task_blocked", { reason });
    await this.operator.sendStatus({ userId: task.requestedByUserId, text: `Blocked: ${reason}` });
    return blocked;
  }

  private async runRole(task: ForgeTask, role: RunnerRole, resumeText?: string): Promise<RunnerResult> {
    const repo = await this.requireRepo(task.repoId);
    const profile = await this.requireProfile(role);
    const runId = this.idFactory();
    const started = transitionForRole(task, role, runId);
    await this.saveTask(started, `${role}_started`, { runId });

    let lastResult: RunnerResult | undefined;
    for (let attempt = 1; attempt <= this.maxRoleRetries + 1; attempt += 1) {
      const result = await this.dispatchRunner(started, repo, profile, role, attempt, resumeText);
      lastResult = result;
      await this.store.saveRunAttempt({
        id: result.runId,
        taskId: task.id,
        role,
        status: result.status === "succeeded" ? "succeeded" : "failed",
        startedAt: new Date(),
        finishedAt: new Date(),
        logPath: result.logPath
      });
      await this.store.appendEvent({
        taskId: task.id,
        eventType: `${role}_finished`,
        payload: { runId: result.runId, status: result.status, attempt },
        createdAt: new Date()
      });

      if (result.status === "succeeded" || result.status === "blocked") {
        return result;
      }
    }

    return lastResult ?? {
      runId,
      status: "failed",
      exitCode: 1,
      logPath: "",
      artifacts: [],
      blockerReason: `${role} runner failed before returning a result`
    };
  }

  private async dispatchRunner(
    task: ForgeTask,
    repo: RepoRegistration,
    profile: RunnerProfile,
    role: RunnerRole,
    attempt: number,
    resumeText?: string
  ): Promise<RunnerResult> {
    const artifactDir = join(this.options.artifactRoot ?? ".auto-forge/artifacts", task.id, role);
    const prompt = await this.promptBuilder.build({
      task,
      repo,
      role,
      briefPath: this.options.briefPath,
      artifactDir,
      resumeText
    });
    const request: RunnerRequest = {
      taskId: task.id,
      repoId: repo.id,
      role,
      profile,
      promptPath: prompt.promptPath,
      artifactDir,
      repoPath: repo.repoPath,
      attempt,
      resumeText
    };
    await this.operator.sendStatus({ userId: task.requestedByUserId, text: `Starting ${role} run for ${task.title}` });
    return this.runner.run(request);
  }

  private async pauseForApproval(
    task: ForgeTask,
    kind: Approval["kind"],
    requestedByRunId: EntityId,
    decisionText: string,
    buttons: Array<{ label: string; value: string }>
  ): Promise<ForgeTask> {
    const approval: Approval = {
      id: this.idFactory(),
      taskId: task.id,
      requestedByRunId,
      decisionText,
      kind,
      status: "pending"
    };
    await this.store.saveApproval(approval);
    const waiting = transitionTask(await this.requireTask(task.id), { type: "request_approval", approvalId: approval.id });
    await this.saveTask(waiting, "approval_requested", { approvalId: approval.id, kind });
    await this.operator.sendApprovalRequest({
      userId: task.requestedByUserId,
      text: decisionText,
      approvalId: approval.id,
      buttons
    });
    return waiting;
  }

  private async blockFromResult(task: ForgeTask, result: RunnerResult): Promise<ForgeTask> {
    this.locks.release(task.repoId, task.id);
    const reason = result.blockerReason ?? `${result.runId} exited with status ${result.status}`;
    const blocked = transitionTask(await this.requireTask(task.id), { type: "block", reason });
    await this.saveTask(blocked, "task_blocked", { reason, runId: result.runId });
    await this.operator.sendStatus({ userId: task.requestedByUserId, text: `Blocked: ${reason}` });
    return blocked;
  }

  private async recordArtifacts(task: ForgeTask, result: RunnerResult): Promise<void> {
    for (const [index, path] of result.artifacts.entries()) {
      await this.store.saveArtifact({
        id: `${result.runId}-artifact-${index}`,
        taskId: task.id,
        path,
        kind: path.endsWith(".jsonl") ? "log" : "report",
        observedAt: new Date()
      });
    }
  }

  private async outcomeFromArtifacts(task: ForgeTask): Promise<{ outcome: QaArtifactOutcome; summary?: string }> {
    const repo = await this.requireRepo(task.repoId);
    const artifactRoot = isAbsolute(this.options.briefPath)
      ? this.options.briefPath
      : join(repo.repoPath, this.options.briefPath);
    const snapshot = await this.artifactWatcher.validate({
      repoPath: repo.repoPath,
      artifactRoot,
      expectedBranch: repo.defaultBranch,
      requireCommitShas: true,
      taskId: task.id
    });
    if (!snapshot.ok) {
      await this.store.appendEvent({
        taskId: task.id,
        eventType: "artifact_validation_failed",
        payload: { errors: snapshot.errors },
        createdAt: new Date()
      });
      return {
        outcome: "blocked",
        summary: snapshot.blockerSummary ?? summarizeArtifactValidationErrors(snapshot.errors, repo.name)
      };
    }
    if (snapshot.qaOutcome === "clear" && snapshot.blockerSummary) {
      return {
        outcome: "blocked",
        summary: snapshot.blockerSummary
      };
    }
    return { outcome: snapshot.qaOutcome };
  }

  private async saveTask(task: ForgeTask, eventType: string, payload: Record<string, unknown>): Promise<void> {
    await this.store.saveTask(task);
    await this.store.appendEvent({ taskId: task.id, eventType, payload, createdAt: new Date() });
  }

  private async requireTask(id: EntityId): Promise<ForgeTask> {
    const task = await this.store.getTask(id);
    if (!task) {
      throw new Error(`Task ${id} not found`);
    }
    return task;
  }

  private async requireRepo(id: EntityId): Promise<RepoRegistration> {
    const repo = await this.store.getRepo(id);
    if (!repo) {
      throw new Error(`Repo ${id} not found`);
    }
    return repo;
  }

  private async requireProfile(role: RunnerRole): Promise<RunnerProfile> {
    const profile = await this.store.getRunnerProfile(role);
    if (!profile) {
      throw new Error(`Runner profile for ${role} not found`);
    }
    return profile;
  }
}

function firstSignal<T extends RunnerSignal["type"]>(
  result: RunnerResult,
  type: T
): Extract<RunnerSignal, { type: T }> | undefined {
  return result.signals?.find((signal): signal is Extract<RunnerSignal, { type: T }> => signal.type === type);
}

function summarizeArtifactValidationErrors(errors: string[], repoAlias: string): string {
  const joined = errors.slice(0, 3).join("; ");
  if (joined.toLowerCase().includes("qa-checkpoint")) {
    return `local QA passed, but GitHub push failed or is pending. ${joined}`;
  }
  if (joined.toLowerCase().includes("remote containment") || joined.toLowerCase().includes("could not read from remote repository")) {
    return `${joined}. GitHub push readiness is not verified; run /repo github-setup ${repoAlias}, install a write-enabled deploy key, then run /repo git-test ${repoAlias}.`;
  }
  return joined ? `QA artifact validation blocked: ${joined}` : "QA artifact validation blocked the task.";
}

function transitionForRole(task: ForgeTask, role: RunnerRole, runId: EntityId): ForgeTask {
  if (role === "scope") {
    return task.status === "scope_running" ? { ...task, currentRunId: runId } : transitionTask(task, { type: "start_scope", runId });
  }
  if (role === "planner") {
    if (task.status === "waiting_approval") {
      return transitionTask(task, { type: "approve", runId, nextStatus: "planning" });
    }
    if (task.status === "qa_running") {
      return { ...task, status: "planning", currentRunId: runId, updatedAt: new Date() };
    }
    return task.status === "planning" ? { ...task, currentRunId: runId } : transitionTask(task, { type: "start_planning", runId });
  }
  if (task.status === "waiting_approval") {
    return transitionTask(task, { type: "approve", runId, nextStatus: role === "qa" ? "qa_running" : "worker_running" });
  }
  if (role === "qa") {
    return task.status === "qa_running" ? { ...task, currentRunId: runId } : { ...task, status: "qa_running", currentRunId: runId };
  }
  return task.status === "worker_running" ? { ...task, currentRunId: runId } : { ...task, status: "worker_running", currentRunId: runId };
}
