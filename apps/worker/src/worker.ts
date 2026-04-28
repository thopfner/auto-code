import type { ForgeRunner, RunnerRequest, RunnerResult } from "../../../packages/core/src/index.js";
import { CodexCliRunner, EnvSecretResolver } from "../../../packages/adapters/src/index.js";
import { writeWorkerHeartbeat } from "../../../packages/ops/src/index.js";

export class WorkerSupervisor {
  constructor(private readonly runner: ForgeRunner) {}

  async dispatch(request: RunnerRequest): Promise<RunnerResult> {
    return this.runner.run(request);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const supervisor = new WorkerSupervisor(new CodexCliRunner(new EnvSecretResolver()));
  await writeWorkerHeartbeat();
  console.log("auto-forge-worker ready", {
    service: "auto-forge-worker",
    runner: "codex-cli",
    pid: process.pid
  });

  const keepAlive = setInterval(() => {
    void supervisor;
    void writeWorkerHeartbeat();
  }, 30_000);
  process.on("SIGTERM", () => {
    clearInterval(keepAlive);
    process.exit(0);
  });
  process.on("SIGINT", () => {
    clearInterval(keepAlive);
    process.exit(0);
  });
}
