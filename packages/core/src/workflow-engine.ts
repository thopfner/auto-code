import { execFile } from "node:child_process";
import { isAbsolute, join, relative } from "node:path";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { createForgeTask, transitionTask } from "./state-machine.js";
import { RepoLockManager } from "./locks.js";
import { ForgeArtifactWatcher, type QaArtifactOutcome } from "./artifacts.js";
import { ForgePromptBuilder } from "./prompt-builder.js";
import type { ForgeRunner, OperatorGateway, RunnerRequest, RunnerResult, RunnerSignal } from "./runner.js";
import type { Approval, EntityId, ForgeTask, RepoRegistration, RunnerProfile, RunnerRole } from "./types.js";
import type { WorkflowStore } from "./workflow-store.js";

const execFileAsync = promisify(execFile);
const fullShaPattern = /^[0-9a-f]{40}$/;

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

interface PublishRetryPlan {
  kind: "publish_retryable";
  artifactRoot: string;
  qaPath: string;
  latestJsonPath: string;
  stateJsonPath: string;
  implementationCommitSha?: string;
  stopReportCommitSha?: string;
  pushStatus?: string;
}

type PublishRetryClassification = PublishRetryPlan | { kind: "full_retry" };
export type TaskRetryMode = "auto" | "publish" | "from-blocker";

export interface TaskRetryAdvice {
  blockerKind?: "publish" | "unsupported" | "not-blocked";
  automaticMode?: Extract<TaskRetryMode, "publish">;
  choices: string[];
  nextAction: string;
}

export class RetryModeRefusedError extends Error {
  constructor(
    message: string,
    readonly choices: string[]
  ) {
    super(message);
  }
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

  async describeTaskRetry(taskId: EntityId): Promise<TaskRetryAdvice> {
    const task = await this.requireTask(taskId);
    if (task.status !== "blocked") {
      return {
        blockerKind: "not-blocked",
        choices: [`/task status ${task.id}`, `/task logs ${task.id}`],
        nextAction: `Task is ${task.status}; retry is only available for blocked tasks.`
      };
    }
    const repo = await this.requireRepo(task.repoId);
    const publishRetry = await this.classifyPublishRetry(task, repo);
    if (publishRetry.kind === "publish_retryable") {
      return {
        blockerKind: "publish",
        automaticMode: "publish",
        choices: [`/task retry ${task.id} publish <reason>`, `/repo git-test ${repo.name}`, `/repo github-setup ${repo.name}`],
        nextAction: `Fix GitHub push readiness, run /repo git-test ${repo.name}, then /task retry ${task.id} publish <reason>.`
      };
    }
    return {
      blockerKind: "unsupported",
      choices: [`/task retry ${task.id} from-blocker <reason>`, `/task logs ${task.id}`, `/task status ${task.id}`],
      nextAction: `Automatic retry is refused. After the blocker is fixed, run /task retry ${task.id} from-blocker <reason>.`
    };
  }

  async retryTask(taskId: EntityId, reason: string, mode: TaskRetryMode = "auto"): Promise<ForgeTask> {
    const task = await this.requireTask(taskId);
    const repo = await this.requireRepo(task.repoId);
    if (repo.isPaused) {
      throw new Error(`Repo ${repo.name} is paused`);
    }
    if (task.status !== "blocked") {
      throw new RetryModeRefusedError(`Task ${task.id} is ${task.status}; only blocked tasks can be retried.`, [
        `/task status ${task.id}`,
        `/task logs ${task.id}`
      ]);
    }

    const publishRetry = await this.classifyPublishRetry(task, repo);
    if (mode === "publish") {
      if (publishRetry.kind !== "publish_retryable") {
        throw new RetryModeRefusedError(`Publish retry refused for task ${task.id}: blocker is not a verified publish failure after clear QA.`, [
          `/task status ${task.id}`,
          `/task logs ${task.id}`,
          `/task retry ${task.id} from-blocker <reason>`
        ]);
      }
      return this.runPublishRetry(task, repo, publishRetry, reason);
    }

    if (mode === "auto" && publishRetry.kind === "publish_retryable") {
      return this.runPublishRetry(task, repo, publishRetry, reason);
    }
    if (mode === "auto") {
      throw new RetryModeRefusedError(`Automatic retry refused for task ${task.id}: blocker is not safely classifiable.`, [
        `/task retry ${task.id} publish <reason>`,
        `/task retry ${task.id} from-blocker <reason>`,
        `/task status ${task.id}`,
        `/task logs ${task.id}`
      ]);
    }

    const retry = transitionTask(task, { type: "retry" });
    await this.saveTask(retry, "task_retry_requested", {
      reason,
      previousBlockedReason: task.blockedReason,
      retryMode: "from_blocker"
    });
    await this.operator.sendStatus({ userId: task.requestedByUserId, text: `Retrying: ${task.title}` });
    return this.runScope(await this.requireTask(task.id));
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
    const artifactRoot = this.artifactRootFor(repo);
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

  private async classifyPublishRetry(task: ForgeTask, repo: RepoRegistration): Promise<PublishRetryClassification> {
    if (task.status !== "blocked") {
      return { kind: "full_retry" };
    }

    const artifactRoot = this.artifactRootFor(repo);
    const qaPath = join(artifactRoot, "automation", "qa.json");
    let qaRecord: Record<string, unknown>;
    try {
      qaRecord = await readJsonObject(qaPath);
    } catch {
      return { kind: "full_retry" };
    }

    if (!isClearQaStatus(firstString(qaRecord, ["qa_status", "status", "outcome"]))) {
      return { kind: "full_retry" };
    }

    const pushStatus = firstString(qaRecord, ["push_status", "pushStatus"]);
    const taskReason = task.blockedReason ?? "";
    const risks = stringArray(qaRecord.openRisks) ?? stringArray(qaRecord.open_risks);
    const hasPublishBlocker =
      isPublishRetryablePushStatus(pushStatus)
      || /push|publish|github|origin/i.test(taskReason)
      || Boolean(risks?.some((risk) => /push|publish|github|origin|credential|auth/i.test(risk)));
    if (!hasPublishBlocker) {
      return { kind: "full_retry" };
    }

    const implementationCommitSha = firstString(qaRecord, ["implementation_commit_sha", "implementationCommitSha"]);
    const stopReportCommitSha = firstString(qaRecord, ["stop_report_commit_sha", "stopReportCommitSha"]);
    return {
      kind: "publish_retryable",
      artifactRoot,
      qaPath,
      latestJsonPath: join(artifactRoot, "reports", "LATEST.json"),
      stateJsonPath: join(artifactRoot, "automation", "state.json"),
      implementationCommitSha,
      stopReportCommitSha,
      pushStatus
    };
  }

  private async runPublishRetry(
    task: ForgeTask,
    repo: RepoRegistration,
    retry: PublishRetryPlan,
    reason: string
  ): Promise<ForgeTask> {
    await this.store.appendEvent({
      taskId: task.id,
      eventType: "task_retry_requested",
      payload: {
        reason,
        previousBlockedReason: task.blockedReason,
        retryMode: "publish_only",
        classifier: "push_failed_after_clear_qa"
      },
      createdAt: new Date()
    });

    const preflight = await this.verifyPublishRetryPreflight(repo, retry);
    if (!preflight.ok) {
      const blocked = {
        ...task,
        status: "blocked" as const,
        blockedReason: preflight.reason,
        currentRunId: undefined,
        pendingApprovalId: undefined,
        updatedAt: new Date()
      };
      await this.saveTask(blocked, "publish_retry_refused", {
        reason: preflight.reason,
        retryMode: "publish_only",
        classifier: "push_failed_after_clear_qa"
      });
      await this.operator.sendStatus({ userId: task.requestedByUserId, text: `Blocked: ${preflight.reason}` });
      return blocked;
    }

    await this.store.appendEvent({
      taskId: task.id,
      eventType: "publish_retry_started",
      payload: {
        branch: repo.defaultBranch,
        expectedHead: retry.stopReportCommitSha,
        previousPushStatus: retry.pushStatus
      },
      createdAt: new Date()
    });
    await this.operator.sendStatus({ userId: task.requestedByUserId, text: `Retrying GitHub publish for ${task.title}` });

    const artifactPaths = [retry.qaPath, retry.latestJsonPath, retry.stateJsonPath];
    const artifactBackup = await readExistingFiles(artifactPaths);
    const pushedAt = new Date().toISOString();
    const pushStatus = `pushed to origin/${repo.defaultBranch}`;
    let publishCommitSha: string | undefined;

    try {
      await updateJsonIfPresent(retry.qaPath, {
        push_status: pushStatus,
        human_input_required: false,
        publish_retry_status: "succeeded",
        publish_retry_completed_at: pushedAt,
        updated_at: pushedAt
      });
      await updateJsonIfPresent(retry.latestJsonPath, {
        push_status: pushStatus,
        publish_retry_status: "succeeded",
        publish_retry_completed_at: pushedAt,
        updated_at: pushedAt
      });
      await updateJsonIfPresent(retry.stateJsonPath, {
        push_status: pushStatus,
        publish_retry_status: "succeeded",
        updated_at: pushedAt
      });

      const add = await gitResult(["add", "-f", "--", ...repoRelativePaths(repo.repoPath, artifactPaths)], repo.repoPath);
      if (!add.ok) {
        await restoreFiles(artifactBackup);
        await gitResult(["reset", "--quiet", "--", ...repoRelativePaths(repo.repoPath, artifactPaths)], repo.repoPath);
        return this.blockPublishRetry(task, repo, "publish_retry_failed", publishPreparationFailureMessage(add.summary), {
          branch: repo.defaultBranch,
          gitOutput: add.summary
        });
      }

      const tree = await gitResult(["write-tree"], repo.repoPath);
      if (!tree.ok) {
        await restoreFiles(artifactBackup);
        await gitResult(["reset", "--quiet", "--", ...repoRelativePaths(repo.repoPath, artifactPaths)], repo.repoPath);
        return this.blockPublishRetry(task, repo, "publish_retry_failed", publishPreparationFailureMessage(tree.summary), {
          branch: repo.defaultBranch,
          gitOutput: tree.summary
        });
      }

      const commit = await gitResult(
        ["commit-tree", tree.stdout.trim(), "-p", retry.stopReportCommitSha ?? "HEAD", "-m", "Record publish retry success"],
        repo.repoPath
      );
      if (!commit.ok) {
        await restoreFiles(artifactBackup);
        await gitResult(["reset", "--quiet", "--", ...repoRelativePaths(repo.repoPath, artifactPaths)], repo.repoPath);
        return this.blockPublishRetry(task, repo, "publish_retry_failed", publishPreparationFailureMessage(commit.summary), {
          branch: repo.defaultBranch,
          gitOutput: commit.summary
        });
      }
      publishCommitSha = commit.stdout.trim();
    } catch (error) {
      await restoreFiles(artifactBackup);
      await gitResult(["reset", "--quiet", "--", ...repoRelativePaths(repo.repoPath, artifactPaths)], repo.repoPath);
      const blocker = publishPreparationFailureMessage(error instanceof Error ? error.message : "failed to prepare publish retry artifacts");
      return this.blockPublishRetry(task, repo, "publish_retry_failed", blocker, {
        branch: repo.defaultBranch,
        gitOutput: error instanceof Error ? error.message : "failed to prepare publish retry artifacts"
      });
    }

    const pushCommand = `git push -u origin ${publishCommitSha}:refs/heads/${repo.defaultBranch}`;
    const push = await gitResult(["push", "-u", "origin", `${publishCommitSha}:refs/heads/${repo.defaultBranch}`], repo.repoPath);
    if (!push.ok) {
      await restoreFiles(artifactBackup);
      await gitResult(["reset", "--quiet", "--", ...repoRelativePaths(repo.repoPath, artifactPaths)], repo.repoPath);
      const blocker = publishFailureMessage(repo.name, push.summary);
      const blocked = {
        ...task,
        status: "blocked" as const,
        blockedReason: blocker,
        currentRunId: undefined,
        pendingApprovalId: undefined,
        updatedAt: new Date()
      };
      await this.saveTask(blocked, "publish_retry_failed", {
        branch: repo.defaultBranch,
        pushCommand,
        blocker,
        gitOutput: push.summary,
        publishCommitSha
      });
      await this.operator.sendStatus({ userId: task.requestedByUserId, text: `Blocked: ${blocker}` });
      return blocked;
    }

    const reset = await gitResult(["reset", "--soft", publishCommitSha], repo.repoPath);
    if (!reset.ok) {
      return this.blockPublishRetry(task, repo, "publish_retry_failed", publishFinalizationFailureMessage(reset.summary), {
        branch: repo.defaultBranch,
        pushCommand,
        gitOutput: reset.summary,
        publishCommitSha
      });
    }
    const status = await gitText(["status", "--short"], repo.repoPath);
    if (status.trim()) {
      return this.blockPublishRetry(
        task,
        repo,
        "publish_retry_failed",
        publishFinalizationFailureMessage(`working tree is dirty after publish retry:\n${status.trim()}`),
        {
          branch: repo.defaultBranch,
          pushCommand,
          gitOutput: push.summary,
          publishCommitSha,
          status: status.trim()
        }
      );
    }

    const completed = {
      ...task,
      status: "completed" as const,
      blockedReason: undefined,
      currentRunId: undefined,
      pendingApprovalId: undefined,
      updatedAt: new Date()
    };
    await this.saveTask(completed, "publish_retry_succeeded", {
      branch: repo.defaultBranch,
      pushCommand,
      gitOutput: push.summary,
      publishCommitSha
    });
    await this.saveTask(completed, "task_completed", { retryMode: "publish_only" });
    await this.operator.sendStatus({
      userId: task.requestedByUserId,
      text: "Completed: local QA passed and GitHub push succeeded."
    });
    return completed;
  }

  private async blockPublishRetry(
    task: ForgeTask,
    repo: RepoRegistration,
    eventType: string,
    blocker: string,
    payload: Record<string, unknown>
  ): Promise<ForgeTask> {
    const blocked = {
      ...task,
      status: "blocked" as const,
      blockedReason: blocker,
      currentRunId: undefined,
      pendingApprovalId: undefined,
      updatedAt: new Date()
    };
    await this.saveTask(blocked, eventType, {
      ...payload,
      blocker,
      retryMode: "publish_only"
    });
    await this.operator.sendStatus({ userId: task.requestedByUserId, text: `Blocked: ${blocker}` });
    return blocked;
  }

  private async verifyPublishRetryPreflight(
    repo: RepoRegistration,
    retry: PublishRetryPlan
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    try {
      const snapshot = await this.artifactWatcher.validate({
        repoPath: repo.repoPath,
        artifactRoot: retry.artifactRoot,
        expectedBranch: repo.defaultBranch,
        requireCommitShas: true
      });
      if (!snapshot.ok) {
        return { ok: false, reason: `Publish retry refused: canonical QA artifacts are not safe: ${snapshot.errors.slice(0, 3).join("; ")}` };
      }
      if (snapshot.qaOutcome !== "clear") {
        return { ok: false, reason: `Publish retry refused: canonical QA status is ${snapshot.qaOutcome}, not clear.` };
      }
      if (!isFullSha(retry.implementationCommitSha) || !isFullSha(retry.stopReportCommitSha)) {
        return { ok: false, reason: "Publish retry refused: automation/qa.json must contain full 40-character implementation and stop-report SHAs." };
      }

      const branch = await gitText(["branch", "--show-current"], repo.repoPath);
      if (branch !== repo.defaultBranch) {
        return { ok: false, reason: `Publish retry refused: git branch is ${branch || "(detached)"}, expected ${repo.defaultBranch}.` };
      }

      const head = await gitText(["rev-parse", "HEAD"], repo.repoPath);
      if (head !== retry.stopReportCommitSha) {
        return { ok: false, reason: `Publish retry refused: git HEAD is ${head}, expected stop report commit ${retry.stopReportCommitSha}.` };
      }

      for (const sha of [retry.implementationCommitSha, retry.stopReportCommitSha]) {
        const resolved = await gitText(["rev-parse", `${sha}^{commit}`], repo.repoPath);
        if (resolved !== sha) {
          return { ok: false, reason: `Publish retry refused: artifact commit ${sha} does not resolve in the repo.` };
        }
      }

      const status = await gitText(["status", "--short"], repo.repoPath);
      if (status.trim()) {
        return { ok: false, reason: `Publish retry refused: working tree is dirty: ${status.trim()}` };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, reason: `Publish retry refused: ${error instanceof Error ? error.message : "git preflight failed"}` };
    }
  }

  private artifactRootFor(repo: RepoRegistration): string {
    return isAbsolute(this.options.briefPath) ? this.options.briefPath : join(repo.repoPath, this.options.briefPath);
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

async function readJsonObject(path: string): Promise<Record<string, unknown>> {
  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${path} must contain a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

async function updateJsonIfPresent(path: string, patch: Record<string, unknown>): Promise<void> {
  let record: Record<string, unknown>;
  try {
    record = await readJsonObject(path);
  } catch {
    return;
  }
  await writeFile(path, `${JSON.stringify({ ...record, ...patch }, null, 2)}\n`);
}

async function readExistingFiles(paths: string[]): Promise<Array<{ path: string; content?: string }>> {
  const files: Array<{ path: string; content?: string }> = [];
  for (const path of paths) {
    try {
      files.push({ path, content: await readFile(path, "utf8") });
    } catch {
      files.push({ path });
    }
  }
  return files;
}

async function restoreFiles(files: Array<{ path: string; content?: string }>): Promise<void> {
  for (const file of files) {
    if (file.content !== undefined) {
      await writeFile(file.path, file.content);
    }
  }
}

function repoRelativePaths(repoPath: string, paths: string[]): string[] {
  return paths.map((path) => relative(repoPath, path));
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;
}

function isClearQaStatus(status: string | undefined): boolean {
  return Boolean(status && /^(CLEAR_CURRENT_PHASE|CLEAR|FINAL_CLEARANCE|PASSED|SUCCESS|SUCCEEDED)$/i.test(status));
}

function isPublishRetryablePushStatus(status: string | undefined): boolean {
  if (!status) {
    return false;
  }
  if (/\b(pushed|succeeded|success|complete|completed|ok)\b/i.test(status)) {
    return false;
  }
  return /\b(failed|failure|blocked|pending|not[_ -]?pushed|auth|credential|denied|rejected|diverged|protected|publish)\b/i.test(status);
}

function isFullSha(value: string | undefined): value is string {
  return Boolean(value && fullShaPattern.test(value));
}

async function gitText(args: string[], cwd: string): Promise<string> {
  const result = await gitResult(args, cwd);
  if (!result.ok) {
    throw new Error(`git ${args.join(" ")} failed. ${result.summary}`);
  }
  return result.stdout.trim();
}

async function gitResult(args: string[], cwd: string): Promise<
  | { ok: true; stdout: string; stderr: string; summary: string }
  | { ok: false; stdout: string; stderr: string; summary: string }
> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, { cwd });
    return {
      ok: true,
      stdout,
      stderr,
      summary: formatGitOutput(stdout, stderr)
    };
  } catch (error) {
    const gitError = error as { stdout?: unknown; stderr?: unknown; code?: unknown };
    const stdout = typeof gitError.stdout === "string" ? gitError.stdout : "";
    const stderr = typeof gitError.stderr === "string" ? gitError.stderr : error instanceof Error ? error.message : "git failed";
    const exitCode = typeof gitError.code === "number" || typeof gitError.code === "string" ? String(gitError.code) : "unknown";
    return {
      ok: false,
      stdout,
      stderr,
      summary: `exit_code=${exitCode}\n${formatGitOutput(stdout, stderr)}`
    };
  }
}

function formatGitOutput(stdout: string, stderr: string): string {
  return `stdout: ${stdout.trim() || "(empty)"}\nstderr: ${stderr.trim() || "(empty)"}`;
}

function publishFailureMessage(repoAlias: string, gitOutput: string): string {
  return [
    "local QA passed, but GitHub push retry failed.",
    gitOutput,
    `Run /repo github-setup ${repoAlias} to repair GitHub deploy-key setup, then run /repo git-test ${repoAlias} before retrying.`
  ].join("\n");
}

function publishPreparationFailureMessage(gitOutput: string): string {
  return [
    "local QA passed, but Auto Forge could not prepare the publish retry artifact commit.",
    gitOutput
  ].join("\n");
}

function publishFinalizationFailureMessage(gitOutput: string): string {
  return [
    "local QA passed and GitHub push succeeded, but Auto Forge could not cleanly finalize the local publish retry state.",
    gitOutput
  ].join("\n");
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
