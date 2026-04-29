import { chmod, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
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

  it("initializes OAuth runs from a read-only source into a writable active CODEX_HOME", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "auto-forge-codex-oauth-"));
    const fakeCodex = join(tempDir, "codex-fake.js");
    const promptPath = join(tempDir, "prompt.md");
    const artifactDir = join(tempDir, "artifacts");
    const authSource = join(tempDir, "auth-source");
    const codexHome = join(tempDir, "codex-home");
    await mkdir(authSource, { recursive: true });
    await writeFile(join(authSource, "auth.json"), '{"access_token":"secret-token"}\n', { mode: 0o600 });
    await writeFile(join(authSource, "config.toml"), 'model = "gpt-5.5"\n', { mode: 0o600 });
    await writeFile(promptPath, "Say ok without changing files.\n");
    await writeFile(
      fakeCodex,
      `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const home = process.env.CODEX_HOME;
if (!home || home === process.env.AUTO_FORGE_CODEX_AUTH_SOURCE_DIR) {
  console.error("active CODEX_HOME must be separate from auth source");
  process.exit(20);
}
fs.writeFileSync(path.join(home, "runtime-write.txt"), "ok\\n");
process.stdin.resume();
process.stdin.on("end", () => {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf("--output-last-message");
  fs.writeFileSync(args[outputIndex + 1], "ok\\n");
  process.stdout.write("ok\\n");
});
`,
      { mode: 0o755 }
    );
    await chmod(fakeCodex, 0o755);

    const previousHome = process.env.CODEX_HOME;
    const previousSource = process.env.AUTO_FORGE_CODEX_AUTH_SOURCE_DIR;
    process.env.CODEX_HOME = codexHome;
    process.env.AUTO_FORGE_CODEX_AUTH_SOURCE_DIR = authSource;
    try {
      const runner = new CodexCliRunner(emptySecrets, { codexBin: fakeCodex, sandbox: "read-only" });
      const result = await runner.run({
        taskId: "task-1",
        repoId: "repo-1",
        role: "qa",
        profile: { ...profileFor("qa"), codexAuthRef: "secret:codex-oauth-local-cache" },
        promptPath,
        artifactDir,
        repoPath: tempDir
      });

      expect(result.status).toBe("succeeded");
      expect(await readFile(join(codexHome, "auth.json"), "utf8")).toContain("secret-token");
      expect(await readFile(join(codexHome, "config.toml"), "utf8")).toContain("gpt-5.5");
      expect(await readFile(join(codexHome, "runtime-write.txt"), "utf8")).toBe("ok\n");
      expect((await stat(codexHome)).mode & 0o777).toBe(0o700);
      expect((await stat(join(codexHome, "auth.json"))).mode & 0o777).toBe(0o600);
    } finally {
      if (previousHome === undefined) {
        delete process.env.CODEX_HOME;
      } else {
        process.env.CODEX_HOME = previousHome;
      }
      if (previousSource === undefined) {
        delete process.env.AUTO_FORGE_CODEX_AUTH_SOURCE_DIR;
      } else {
        process.env.AUTO_FORGE_CODEX_AUTH_SOURCE_DIR = previousSource;
      }
    }
  });

  it("returns an actionable redacted blocker for read-only Codex runtime failures", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "auto-forge-codex-failure-"));
    const fakeCodex = join(tempDir, "codex-fake.js");
    const promptPath = join(tempDir, "prompt.md");
    const artifactDir = join(tempDir, "artifacts");
    await writeFile(promptPath, "Say ok without changing files.\n");
    await writeFile(
      fakeCodex,
      `#!/usr/bin/env node
console.error("ERROR Failed to create session: Read-only file system (os error 30) sk-testsecret1234567890");
process.exit(1);
`,
      { mode: 0o755 }
    );
    await chmod(fakeCodex, 0o755);

    const runner = new CodexCliRunner(emptySecrets, { codexBin: fakeCodex, sandbox: "read-only" });
    const result = await runner.run({
      taskId: "task-1",
      repoId: "repo-1",
      role: "qa",
      profile: profileFor("qa"),
      promptPath,
      artifactDir,
      repoPath: tempDir
    });

    expect(result.status).toBe("blocked");
    expect(result.blockerReason).toContain("CODEX_HOME=/data/codex-home");
    expect(result.blockerReason).not.toContain("sk-testsecret");
    expect(await readFile(result.logPath, "utf8")).toContain("sk-testsecret1234567890");
  });

  it("redacts auth JSON and opaque tokens from generic blocker summaries", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "auto-forge-codex-redaction-"));
    const fakeCodex = join(tempDir, "codex-fake.js");
    const promptPath = join(tempDir, "prompt.md");
    const artifactDir = join(tempDir, "artifacts");
    const opaque = "a".repeat(48);
    await writeFile(promptPath, "Say ok without changing files.\n");
    await writeFile(
      fakeCodex,
      `#!/usr/bin/env node
console.error('Unexpected model failure {"access_token":"${opaque}","client_secret":"${opaque}"} Bearer ${opaque}');
process.exit(1);
`,
      { mode: 0o755 }
    );
    await chmod(fakeCodex, 0o755);

    const runner = new CodexCliRunner(emptySecrets, { codexBin: fakeCodex, sandbox: "read-only" });
    const result = await runner.run({
      taskId: "task-1",
      repoId: "repo-1",
      role: "qa",
      profile: profileFor("qa"),
      promptPath,
      artifactDir,
      repoPath: tempDir
    });

    expect(result.status).toBe("failed");
    expect(result.blockerReason).toContain("[REDACTED]");
    expect(result.blockerReason).toContain("Bearer [REDACTED_BEARER_TOKEN]");
    expect(result.blockerReason).not.toContain(opaque);
    expect(await readFile(result.logPath, "utf8")).toContain(opaque);
  });

  it("classifies artifact write failures as blocked to avoid retry spam", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "auto-forge-codex-artifact-"));
    const fakeCodex = join(tempDir, "codex-fake.js");
    const promptPath = join(tempDir, "prompt.md");
    const artifactDir = join(tempDir, "artifacts");
    await writeFile(promptPath, "Say ok without changing files.\n");
    await writeFile(
      fakeCodex,
      `#!/usr/bin/env node
console.error("failed to write --output-last-message: disk full");
process.exit(1);
`,
      { mode: 0o755 }
    );
    await chmod(fakeCodex, 0o755);

    const runner = new CodexCliRunner(emptySecrets, { codexBin: fakeCodex, sandbox: "read-only" });
    const result = await runner.run({
      taskId: "task-1",
      repoId: "repo-1",
      role: "qa",
      profile: profileFor("qa"),
      promptPath,
      artifactDir,
      repoPath: tempDir
    });

    expect(result.status).toBe("blocked");
    expect(result.blockerReason).toContain("runner output or artifacts");
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
