import type { ForgeRunner, RunnerRequest, RunnerResult } from "../../../packages/core/src/index.js";

export class WorkerSupervisor {
  constructor(private readonly runner: ForgeRunner) {}

  async dispatch(request: RunnerRequest): Promise<RunnerResult> {
    return this.runner.run(request);
  }
}
