import type { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertManagedOpenClawWorkspace,
  bootstrapManagedOpenClawWorkspace,
  managedOpenClawMarker,
  managedOpenClawWorkspaceFiles
} from "../packages/ops/src/index.js";

describe("managed OpenClaw bootstrap", () => {
  it("creates the managed workspace files, removes BOOTSTRAP.md, and validates config", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-forge-openclaw-bootstrap-"));
    const workspaceDir = join(root, "workspace");
    await mkdir(workspaceDir);
    await writeFile(join(workspaceDir, "BOOTSTRAP.md"), "generic OpenClaw bootstrap\n");

    const commands: string[] = [];
    const result = await bootstrapManagedOpenClawWorkspace({
      workspaceDir,
      execFileImpl: fakeOpenClaw(commands),
      now: new Date("2026-04-29T00:00:00.000Z")
    });

    await assertManagedOpenClawWorkspace(workspaceDir);
    expect((await stat(workspaceDir)).mode & 0o777).toBe(0o700);
    expect(result.written.sort()).toEqual([...managedOpenClawWorkspaceFiles].sort());
    expect(result.removedBootstrap).toBe("BOOTSTRAP.md");
    expect(commands).toEqual([
      `openclaw config set gateway.mode local`,
      `openclaw config set gateway.port 18789`,
      `openclaw config set agents.defaults.workspace ${workspaceDir}`,
      `openclaw config validate`
    ]);
    expect(result.validatedConfig).toBe(true);

    for (const file of managedOpenClawWorkspaceFiles) {
      const content = await readFile(join(workspaceDir, file), "utf8");
      expect(content).toContain(managedOpenClawMarker);
      expect(content).toContain("Auto Forge");
    }
  });

  it("is idempotent for already managed files", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-forge-openclaw-idempotent-"));
    const workspaceDir = join(root, "workspace");
    const now = new Date("2026-04-29T00:00:00.000Z");

    await bootstrapManagedOpenClawWorkspace({ workspaceDir, configureCli: false, now });
    const rerun = await bootstrapManagedOpenClawWorkspace({ workspaceDir, configureCli: false, now });

    expect(rerun.written).toEqual([]);
    expect(rerun.unchanged.sort()).toEqual([...managedOpenClawWorkspaceFiles].sort());
    expect(rerun.backups).toEqual([]);
    expect(await readdir(workspaceDir)).not.toContain("BOOTSTRAP.md");
  });

  it("backs up unmanaged files instead of overwriting them silently", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-forge-openclaw-backup-"));
    const workspaceDir = join(root, "workspace");
    await bootstrapManagedOpenClawWorkspace({ workspaceDir, configureCli: false });
    await writeFile(join(workspaceDir, "AGENTS.md"), "operator notes\n");
    await writeFile(join(workspaceDir, "BOOTSTRAP.md"), "generic bootstrap\n");

    const result = await bootstrapManagedOpenClawWorkspace({
      workspaceDir,
      configureCli: false,
      now: new Date("2026-04-29T01:02:03.000Z")
    });

    expect(result.backups.map((backup) => backup.original).sort()).toEqual(["AGENTS.md", "BOOTSTRAP.md"]);
    const files = await readdir(workspaceDir);
    expect(files).toContain("AGENTS.md.auto-forge-backup-2026-04-29T01-02-03Z");
    expect(files).toContain("BOOTSTRAP.md.auto-forge-backup-2026-04-29T01-02-03Z");
    expect(files).not.toContain("BOOTSTRAP.md");
    expect(await readFile(join(workspaceDir, "AGENTS.md.auto-forge-backup-2026-04-29T01-02-03Z"), "utf8")).toContain("operator notes");
  });

  it("fails closed when OpenClaw config validation fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-forge-openclaw-validate-"));
    const commands: string[] = [];

    await expect(
      bootstrapManagedOpenClawWorkspace({
        workspaceDir: join(root, "workspace"),
        execFileImpl: fakeOpenClaw(commands, "validate failed")
      })
    ).rejects.toThrow("openclaw config validate");

    expect(commands).toContain("openclaw config validate");
  });

  it("does not write raw Telegram or OpenAI secrets into workspace files", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-forge-openclaw-secrets-"));
    const workspaceDir = join(root, "workspace");

    await bootstrapManagedOpenClawWorkspace({ workspaceDir, configureCli: false });

    const combined = (
      await Promise.all(managedOpenClawWorkspaceFiles.map((file) => readFile(join(workspaceDir, file), "utf8")))
    ).join("\n");
    expect(combined).not.toContain("raw-telegram-token");
    expect(combined).not.toContain("raw-openai-key");
  });
});

function fakeOpenClaw(commands: string[], validateError?: string): typeof execFile {
  return ((command: string, args: readonly string[], optionsOrCallback: unknown, callback?: ExecCallback) => {
    const cb = typeof optionsOrCallback === "function" ? optionsOrCallback : callback;
    commands.push(`${command} ${args.join(" ")}`);
    if (!cb) {
      return;
    }
    if (validateError && args.join(" ") === "config validate") {
      cb(new Error(validateError), "", "");
      return;
    }
    cb(null, "", "");
  }) as unknown as typeof execFile;
}

type ExecCallback = (error: Error | null, stdout: string, stderr: string) => void;
