import type { ForgeRunner, RunnerRequest, RunnerResult } from "../../core/src/index.js";

export class FakeForgeRunner implements ForgeRunner {
  readonly requests: RunnerRequest[] = [];

  constructor(private readonly behavior: "succeed" | "fail" | "block" = "succeed") {}

  async run(request: RunnerRequest): Promise<RunnerResult> {
    this.requests.push(request);
    const runId = `fake-${request.role}-${this.requests.length}`;

    if (this.behavior === "fail") {
      return {
        runId,
        status: "failed",
        exitCode: 1,
        logPath: `${request.artifactDir}/${runId}.jsonl`,
        artifacts: []
      };
    }

    if (this.behavior === "block") {
      return {
        runId,
        status: "blocked",
        exitCode: 2,
        logPath: `${request.artifactDir}/${runId}.jsonl`,
        artifacts: [],
        blockerReason: "fake external blocker"
      };
    }

    return {
      runId,
      status: "succeeded",
      exitCode: 0,
      logPath: `${request.artifactDir}/${runId}.jsonl`,
      artifacts: [`${request.artifactDir}/reports/LATEST.md`]
    };
  }
}
