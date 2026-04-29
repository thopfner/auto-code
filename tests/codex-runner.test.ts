import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CodexCliRunner, resolveCodexCliCommand } from "../packages/adapters/src/index.js";
import type { SecretResolver } from "../packages/adapters/src/secrets.js";
import type { RunnerProfile } from "../packages/core/src/index.js";

const emptySecrets: SecretResolver = {
  async resolve() {
    return undefined;
  }
};

describe("Codex CLI runner adapter", () => {
  it("resolves the repo-managed Codex binary with a sanitized PATH", async () => {
    const resolved = await resolveCodexCliCommand({ env: { PATH: "/usr/bin:/bin" } });

    expect(resolved.source).toBe("managed");
    expect(resolved.command).toContain("node_modules/.bin/codex");
  });

  it("passes a local Codex smoke check without invoking a model run", async () => {
    const previousOverride = process.env.CODEX_CLI_COMMAND;
    delete process.env.CODEX_CLI_COMMAND;
    const runner = new CodexCliRunner(emptySecrets);
    const smoke = await runner.smoke().finally(() => {
      if (previousOverride === undefined) {
        delete process.env.CODEX_CLI_COMMAND;
      } else {
        process.env.CODEX_CLI_COMMAND = previousOverride;
      }
    });

    expect(smoke.ok).toBe(true);
    expect(smoke.version).toContain("codex");
  });

  it("runs through codex exec with the current approval config contract", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "auto-forge-codex-runner-"));
    const fakeCodex = join(tempDir, "codex-fake.js");
    const promptPath = join(tempDir, "prompt.md");
    const artifactDir = join(tempDir, "artifacts");
    await writeFile(promptPath, "Say ok without changing files.\n");
    await writeFile(
      fakeCodex,
      `#!/usr/bin/env node
const fs = require("node:fs");
const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const args = process.argv.slice(2);
  if (args.includes("--ask-for-approval")) {
    console.error("obsolete approval flag");
    process.exit(2);
  }
  const outputIndex = args.indexOf("--output-last-message");
  if (outputIndex === -1 || !args[outputIndex + 1]) {
    console.error("missing output path");
    process.exit(3);
  }
  if (!args.includes("--config") || !args.includes('approval_policy="never"')) {
    console.error("missing approval policy config");
    process.exit(4);
  }
  if (!args.includes("--sandbox") || !args.includes("read-only")) {
    console.error("missing read-only sandbox");
    process.exit(5);
  }
  if (!args.includes("--ephemeral")) {
    console.error("missing ephemeral run flag");
    process.exit(6);
  }
  if (!args.includes("--skip-git-repo-check")) {
    console.error("missing git repo check bypass for registered controller repo");
    process.exit(7);
  }
  const modelIndex = args.indexOf("--model");
  if (modelIndex === -1 || args[modelIndex + 1] !== "gpt-5.5") {
    console.error("missing configured model");
    process.exit(8);
  }
  fs.writeFileSync(args[outputIndex + 1], "ok\\n");
  process.stdout.write(JSON.stringify({ type: "final", input: Buffer.concat(chunks).toString("utf8") }) + "\\n");
});
`,
      { mode: 0o755 }
    );
    await chmod(fakeCodex, 0o755);

    const runner = new CodexCliRunner(emptySecrets, { codexBin: fakeCodex, sandbox: "read-only" });
    const result = await runner.run({
      taskId: "task-1",
      repoId: "repo-1",
      role: "qa",
      profile: { ...profileFor("qa"), model: "gpt-5.5" },
      promptPath,
      artifactDir,
      repoPath: tempDir
    });

    expect(result.status).toBe("succeeded");
    expect(result.exitCode).toBe(0);
    expect(await readFile(result.logPath, "utf8")).toContain("Say ok without changing files.");
  });
});

function profileFor(role: RunnerProfile["role"]): RunnerProfile {
  return {
    id: `profile-${role}`,
    name: `${role} profile`,
    role,
    codexAuthRef: "env:OPENAI_API_KEY",
    createdAt: new Date("2026-04-28T00:00:00Z")
  };
}
