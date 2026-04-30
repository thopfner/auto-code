import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const fullShaPattern = /^[0-9a-f]{40}$/;

export type QaArtifactOutcome = "clear" | "revision" | "replan" | "blocked" | "unknown";

export interface ArtifactValidationOptions {
  repoPath: string;
  artifactRoot?: string;
  expectedBranch?: string;
  requireCommitShas?: boolean;
  taskId?: string;
}

export interface ArtifactFileSnapshot {
  path: string;
  sha256: string;
}

export interface ForgeArtifactSnapshot {
  ok: boolean;
  files: ArtifactFileSnapshot[];
  branch: string;
  headSha: string;
  pushed: boolean | "unknown";
  qaOutcome: QaArtifactOutcome;
  blockerSummary?: string;
  errors: string[];
}

export class ForgeArtifactWatcher {
  async validate(options: ArtifactValidationOptions): Promise<ForgeArtifactSnapshot> {
    return validateForgeArtifacts(options);
  }
}

export async function validateForgeArtifacts(options: ArtifactValidationOptions): Promise<ForgeArtifactSnapshot> {
  const artifactRoot = options.artifactRoot ?? options.repoPath;
  const errors: string[] = [];
  const files: ArtifactFileSnapshot[] = [];
  const latestMdPath = join(artifactRoot, "reports", "LATEST.md");
  const latestJsonPath = join(artifactRoot, "reports", "LATEST.json");
  const stateJsonPath = join(artifactRoot, "automation", "state.json");
  const qaJsonPath = join(artifactRoot, "automation", "qa.json");
  const qaCheckpointPath = join(artifactRoot, "automation", "qa-checkpoint.json");

  const latestMd = await readRequired(latestMdPath, errors);
  if (latestMd !== undefined && latestMd.trim().length === 0) {
    errors.push(`${relative(artifactRoot, latestMdPath)} is empty`);
  }

  const latestJson = await readJsonRecord(latestJsonPath, artifactRoot, errors);
  const stateJson = await readJsonRecord(stateJsonPath, artifactRoot, errors);
  const qaJson = await readJsonRecord(qaJsonPath, artifactRoot, errors);
  const qaCheckpointJson = await readOptionalJsonRecord(qaCheckpointPath, artifactRoot, errors);
  const taskQaJson = await readTaskQaJson(artifactRoot, options.taskId, errors);

  for (const path of [latestMdPath, latestJsonPath, stateJsonPath, qaJsonPath, qaCheckpointJson?.path, taskQaJson?.path].filter(
    (candidate): candidate is string => Boolean(candidate)
  )) {
    if (await exists(path)) {
      const content = await readFile(path);
      files.push({ path, sha256: createHash("sha256").update(content).digest("hex") });
    }
  }

  const effectiveQaRecord = taskQaJson?.record ?? qaJson ?? qaCheckpointJson?.record;
  const qaOutcome = qaOutcomeFrom(effectiveQaRecord);
  const blockerSummary = blockerSummaryFrom(effectiveQaRecord);

  validateShaFields("reports/LATEST.json", latestJson, options.requireCommitShas, errors);
  validateShaFields("automation/state.json", stateJson, options.requireCommitShas, errors);
  validateShaFields("automation/qa.json", qaJson, options.requireCommitShas && !qaCheckpointJson, errors);
  if (taskQaJson) {
    validateShaFields(relative(artifactRoot, taskQaJson.path), taskQaJson.record, false, errors);
  }
  if (!qaJson && qaCheckpointJson) {
    errors.push(
      "automation/qa.json is missing; automation/qa-checkpoint.json was accepted as a fallback but future QA runs must write the canonical artifact"
    );
  }

  const branch = await git(["branch", "--show-current"], options.repoPath, errors);
  if (options.expectedBranch && branch && branch !== options.expectedBranch) {
    errors.push(`git branch is ${branch}; expected ${options.expectedBranch}`);
  }

  const headSha = await git(["rev-parse", "HEAD"], options.repoPath, errors);
  if (headSha && !fullShaPattern.test(headSha)) {
    errors.push(`git HEAD is not a full SHA: ${headSha}`);
  }

  const pushed = await detectPushed(options.repoPath, headSha, errors);

  return {
    ok: errors.length === 0,
    files,
    branch: branch ?? "",
    headSha: headSha ?? "",
    pushed,
    qaOutcome,
    blockerSummary,
    errors
  };
}

function validateShaFields(
  label: string,
  record: Record<string, unknown> | undefined,
  requireCommitShas: boolean | undefined,
  errors: string[]
): void {
  if (!record) {
    return;
  }

  for (const field of ["implementation_commit_sha", "stop_report_commit_sha"]) {
    const value = record[field];
    if (typeof value === "string" && !fullShaPattern.test(value)) {
      errors.push(`${label} ${field} is not a full 40-character SHA`);
    }
    if (requireCommitShas && typeof value !== "string") {
      errors.push(`${label} is missing ${field}`);
    }
  }
}

function qaOutcomeFrom(record: Record<string, unknown> | undefined): QaArtifactOutcome {
  const nestedQa = nestedRecord(record, "qa");
  const raw = firstString(record, ["qa_status", "outcome", "status", "stop_status"])?.toUpperCase()
    ?? firstString(nestedQa, ["status", "outcome", "qa_status"])?.toUpperCase();
  switch (raw) {
    case "CLEAR":
    case "CLEAR_CURRENT_PHASE":
    case "FINAL_CLEARANCE":
    case "PASSED":
    case "SUCCESS":
    case "SUCCEEDED":
      return "clear";
    case "REVISION":
    case "REVISION_REQUIRED":
    case "REVISION_PACK_REQUIRED":
      return "revision";
    case "REPLAN":
    case "REPLAN_REQUIRED":
      return "replan";
    case "BLOCKED":
    case "BLOCKED_EXTERNAL":
    case "FAILED":
      return "blocked";
    default:
      return "unknown";
  }
}

function blockerSummaryFrom(record: Record<string, unknown> | undefined): string | undefined {
  if (!record) {
    return undefined;
  }
  const pushStatus = firstString(record, ["push_status", "pushStatus"]);
  const humanInputRequired = record.human_input_required === true || record.humanInputRequired === true;
  const risks = stringArray(record.openRisks) ?? stringArray(record.open_risks);
  const riskSummary = risks?.find((risk) => /push|credential|auth|publish|origin/i.test(risk));
  if (qaOutcomeFrom(record) === "clear" && (humanInputRequired || isBlockingPushStatus(pushStatus) || riskSummary)) {
    return `local QA passed, but GitHub push failed or is pending${pushStatus ? ` (${pushStatus})` : ""}${riskSummary ? `: ${riskSummary}` : "."}`;
  }
  return undefined;
}

function isBlockingPushStatus(pushStatus: string | undefined): boolean {
  if (!pushStatus) {
    return false;
  }
  if (/\b(pushed|succeeded|success|complete|completed|ok)\b/i.test(pushStatus)) {
    return false;
  }
  return /\b(failed|failure|blocked|pending|not[_ -]?pushed|auth|credential|denied|rejected|diverged|protected|publish)\b/i.test(pushStatus);
}

function firstString(record: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function nestedRecord(record: Record<string, unknown> | undefined, key: string): Record<string, unknown> | undefined {
  const value = record?.[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;
}

async function readTaskQaJson(
  artifactRoot: string,
  taskId: string | undefined,
  errors: string[]
): Promise<{ path: string; record: Record<string, unknown> } | undefined> {
  if (!taskId) {
    return undefined;
  }

  const automationRoot = join(artifactRoot, "automation");
  let candidates: string[];
  try {
    candidates = (await readdir(automationRoot))
      .filter((name) => name.endsWith(".json") && name.includes(taskId) && name !== "qa.json")
      .map((name) => join(automationRoot, name));
  } catch {
    return undefined;
  }

  const records: Array<{ path: string; record: Record<string, unknown>; updatedAt: number }> = [];
  for (const path of candidates.sort()) {
    const record = await readJsonRecord(path, artifactRoot, errors);
    if (record) {
      records.push({ path, record, updatedAt: timestampFrom(record) });
    }
  }

  return records.sort((left, right) => right.updatedAt - left.updatedAt || right.path.localeCompare(left.path))[0];
}

function timestampFrom(record: Record<string, unknown>): number {
  const value = firstString(record, ["updated_at", "updatedAt", "created_at", "createdAt"]);
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

async function readRequired(path: string, errors: string[]): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    errors.push(`${path} is missing or unreadable: ${error instanceof Error ? error.message : "read failed"}`);
    return undefined;
  }
}

async function readJsonRecord(
  path: string,
  root: string,
  errors: string[]
): Promise<Record<string, unknown> | undefined> {
  const content = await readRequired(path, errors);
  if (content === undefined) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errors.push(`${relative(root, path)} must contain a JSON object`);
      return undefined;
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    errors.push(`${relative(root, path)} is invalid JSON: ${error instanceof Error ? error.message : "parse failed"}`);
    return undefined;
  }
}

async function readOptionalJsonRecord(
  path: string,
  root: string,
  errors: string[]
): Promise<{ path: string; record: Record<string, unknown> } | undefined> {
  if (!(await exists(path))) {
    return undefined;
  }
  const record = await readJsonRecord(path, root, errors);
  return record ? { path, record } : undefined;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function git(args: string[], cwd: string, errors: string[]): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd });
    return stdout.trim();
  } catch (error) {
    errors.push(`git ${args.join(" ")} failed: ${error instanceof Error ? error.message : "git failed"}`);
    return undefined;
  }
}

async function detectPushed(
  cwd: string,
  headSha: string | undefined,
  errors: string[]
): Promise<boolean | "unknown"> {
  if (!headSha) {
    return "unknown";
  }

  try {
    const { stdout } = await execFileAsync("git", ["branch", "-r", "--contains", headSha], { cwd });
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .some((line) => line.length > 0 && !line.includes("->"));
  } catch (error) {
    errors.push(`git remote containment check failed: ${error instanceof Error ? error.message : "git failed"}`);
    return "unknown";
  }
}
