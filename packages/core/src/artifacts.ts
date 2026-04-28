import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
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

  const latestMd = await readRequired(latestMdPath, errors);
  if (latestMd !== undefined && latestMd.trim().length === 0) {
    errors.push(`${relative(artifactRoot, latestMdPath)} is empty`);
  }

  const latestJson = await readJsonRecord(latestJsonPath, artifactRoot, errors);
  const stateJson = await readJsonRecord(stateJsonPath, artifactRoot, errors);
  const qaJson = await readJsonRecord(qaJsonPath, artifactRoot, errors);

  for (const path of [latestMdPath, latestJsonPath, stateJsonPath, qaJsonPath]) {
    if (await exists(path)) {
      const content = await readFile(path);
      files.push({ path, sha256: createHash("sha256").update(content).digest("hex") });
    }
  }

  validateShaFields("reports/LATEST.json", latestJson, options.requireCommitShas, errors);
  validateShaFields("automation/state.json", stateJson, options.requireCommitShas, errors);
  validateShaFields("automation/qa.json", qaJson, options.requireCommitShas, errors);

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
    qaOutcome: qaOutcomeFrom(qaJson),
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
  const raw = typeof record?.qa_status === "string" ? record.qa_status : undefined;
  switch (raw) {
    case "CLEAR_CURRENT_PHASE":
    case "FINAL_CLEARANCE":
      return "clear";
    case "REVISION_REQUIRED":
      return "revision";
    case "REPLAN_REQUIRED":
      return "replan";
    case "BLOCKED":
      return "blocked";
    default:
      return "unknown";
  }
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
