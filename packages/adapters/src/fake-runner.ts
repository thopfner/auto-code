import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ForgeRunner, RunnerRequest, RunnerResult, RunnerSignal } from "../../core/src/index.js";

export class FakeForgeRunner implements ForgeRunner {
  readonly requests: RunnerRequest[] = [];
  private readonly queue: FakeRunnerStep[];

  constructor(behavior: "succeed" | "fail" | "block" | FakeRunnerStep[] = "succeed") {
    this.queue = Array.isArray(behavior) ? [...behavior] : [{ status: behavior === "succeed" ? "succeeded" : behavior }];
  }

  async run(request: RunnerRequest): Promise<RunnerResult> {
    this.requests.push(request);
    const runId = `fake-${request.role}-${this.requests.length}`;
    const step = this.queue.shift() ?? { status: "succeeded" };

    if (step.writeForgeArtifacts) {
      await writeFakeForgeArtifacts(request.artifactDir, step.writeForgeArtifacts);
    }

    if (step.status === "failed" || step.status === "fail") {
      return {
        runId,
        status: "failed",
        exitCode: 1,
        logPath: `${request.artifactDir}/${runId}.jsonl`,
        artifacts: []
      };
    }

    if (step.status === "blocked" || step.status === "block") {
      return {
        runId,
        status: "blocked",
        exitCode: 2,
        logPath: `${request.artifactDir}/${runId}.jsonl`,
        artifacts: [],
        blockerReason: step.blockerReason ?? "fake external blocker"
      };
    }

    return {
      runId,
      status: "succeeded",
      exitCode: 0,
      logPath: `${request.artifactDir}/${runId}.jsonl`,
      artifacts: [`${request.artifactDir}/reports/LATEST.md`],
      signals: step.signals
    };
  }
}

export interface FakeRunnerStep {
  status: "succeeded" | "failed" | "blocked" | "fail" | "block";
  signals?: RunnerSignal[];
  blockerReason?: string;
  writeForgeArtifacts?: {
    qaStatus?: "CLEAR_CURRENT_PHASE" | "REVISION_REQUIRED" | "REPLAN_REQUIRED" | "BLOCKED";
    implementationCommitSha?: string;
    stopReportCommitSha?: string;
  };
}

async function writeFakeForgeArtifacts(
  artifactDir: string,
  options: NonNullable<FakeRunnerStep["writeForgeArtifacts"]>
): Promise<void> {
  await mkdir(join(artifactDir, "reports"), { recursive: true });
  await mkdir(join(artifactDir, "automation"), { recursive: true });
  const implementationCommitSha = options.implementationCommitSha ?? "1111111111111111111111111111111111111111";
  const stopReportCommitSha = options.stopReportCommitSha ?? "2222222222222222222222222222222222222222";
  const updatedAt = "2026-04-28T00:00:00Z";
  const latest = {
    brief_id: "fake-brief",
    latest_report: "reports/fake.md",
    updated_at: updatedAt,
    stop_status: options.qaStatus ?? "CLEAR_CURRENT_PHASE",
    implementation_commit_sha: implementationCommitSha,
    stop_report_commit_sha: stopReportCommitSha
  };
  const state = {
    brief_id: "fake-brief",
    authorized_phase: "fake-phase.md",
    status: "QA_CHECKPOINT",
    branch: "main",
    implementation_commit_sha: implementationCommitSha,
    latest_report: "reports/fake.md",
    updated_at: updatedAt
  };
  const qa = {
    brief_id: "fake-brief",
    qa_status: options.qaStatus ?? "CLEAR_CURRENT_PHASE",
    implementation_commit_sha: implementationCommitSha,
    stop_report_commit_sha: stopReportCommitSha,
    updated_at: updatedAt
  };
  await writeFile(join(artifactDir, "reports", "LATEST.md"), "# Fake latest report\n");
  await writeFile(join(artifactDir, "reports", "LATEST.json"), `${JSON.stringify(latest, null, 2)}\n`);
  await writeFile(join(artifactDir, "automation", "state.json"), `${JSON.stringify(state, null, 2)}\n`);
  await writeFile(join(artifactDir, "automation", "qa.json"), `${JSON.stringify(qa, null, 2)}\n`);
}
