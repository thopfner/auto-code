import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { validateForgeArtifacts } from "../packages/core/src/index.js";

const execFileAsync = promisify(execFile);

describe("Forge artifact validation", () => {
  it("validates reports, automation JSON, git branch, full SHAs, and push status", async () => {
    const repoPath = await createGitRepo();
    const artifactRoot = await writeArtifacts(repoPath, {
      implementationCommitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      stopReportCommitSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      qaStatus: "CLEAR_CURRENT_PHASE"
    });

    const snapshot = await validateForgeArtifacts({
      repoPath,
      artifactRoot,
      expectedBranch: "main",
      requireCommitShas: true
    });

    expect(snapshot.ok).toBe(true);
    expect(snapshot.branch).toBe("main");
    expect(snapshot.headSha).toMatch(/^[0-9a-f]{40}$/);
    expect(snapshot.pushed).toBe(false);
    expect(snapshot.qaOutcome).toBe("clear");
    expect(snapshot.files).toHaveLength(4);
  });

  it("rejects short commit SHAs in machine-readable artifacts", async () => {
    const repoPath = await createGitRepo();
    const artifactRoot = await writeArtifacts(repoPath, {
      implementationCommitSha: "abc123",
      stopReportCommitSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      qaStatus: "REVISION_REQUIRED"
    });

    const snapshot = await validateForgeArtifacts({
      repoPath,
      artifactRoot,
      expectedBranch: "main",
      requireCommitShas: true
    });

    expect(snapshot.ok).toBe(false);
    expect(snapshot.qaOutcome).toBe("revision");
    expect(snapshot.errors).toContain("reports/LATEST.json implementation_commit_sha is not a full 40-character SHA");
  });
});

async function createGitRepo(): Promise<string> {
  const repoPath = await mkdtemp(join(tmpdir(), "auto-forge-artifacts-"));
  await execFileAsync("git", ["init", "-b", "main"], { cwd: repoPath });
  await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: repoPath });
  await execFileAsync("git", ["config", "user.name", "Test User"], { cwd: repoPath });
  await writeFile(join(repoPath, "README.md"), "# Fixture\n");
  await execFileAsync("git", ["add", "README.md"], { cwd: repoPath });
  await execFileAsync("git", ["commit", "-m", "Initial"], { cwd: repoPath });
  return repoPath;
}

async function writeArtifacts(
  repoPath: string,
  options: {
    implementationCommitSha: string;
    stopReportCommitSha: string;
    qaStatus: "CLEAR_CURRENT_PHASE" | "REVISION_REQUIRED";
  }
): Promise<string> {
  const artifactRoot = join(repoPath, "brief");
  await mkdir(join(artifactRoot, "reports"), { recursive: true });
  await mkdir(join(artifactRoot, "automation"), { recursive: true });
  const base = {
    brief_id: "fixture",
    updated_at: "2026-04-28T00:00:00Z",
    implementation_commit_sha: options.implementationCommitSha,
    stop_report_commit_sha: options.stopReportCommitSha
  };
  await writeFile(join(artifactRoot, "reports", "LATEST.md"), "# Latest\n");
  await writeFile(
    join(artifactRoot, "reports", "LATEST.json"),
    `${JSON.stringify({ ...base, latest_report: "reports/latest.md" }, null, 2)}\n`
  );
  await writeFile(
    join(artifactRoot, "automation", "state.json"),
    `${JSON.stringify({ ...base, status: "QA_CHECKPOINT" }, null, 2)}\n`
  );
  await writeFile(
    join(artifactRoot, "automation", "qa.json"),
    `${JSON.stringify({ ...base, qa_status: options.qaStatus }, null, 2)}\n`
  );
  return artifactRoot;
}
