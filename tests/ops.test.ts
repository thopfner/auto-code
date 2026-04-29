import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectHealth,
  createBackup,
  discoverServiceLogs,
  resolveOpsPaths,
  restoreBackup,
  runInstallDocumentationDryRun,
  writeWorkerHeartbeat
} from "../packages/ops/src/index.js";
import type { ControllerSetup } from "../packages/core/src/index.js";

const setup: ControllerSetup = {
  configuredByUserId: "user-1",
  updatedAt: "2026-04-28T00:00:00.000Z",
  openClaw: {
    baseUrl: "http://localhost:8080",
    tokenRef: "env:OPENCLAW_TOKEN",
    agentHookPath: "/hooks/agent"
  },
  telegram: {
    botTokenRef: "env:TELEGRAM_BOT_TOKEN",
    testChatId: "-100123",
    registerCommands: true,
    sendTestMessage: false,
    commands: ["scope", "status", "queue"]
  }
};

describe("ops health and backup", () => {
  it("reports local health without leaking secrets", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-forge-ops-"));
    const setupPath = join(root, ".auto-forge", "setup.json");
    const workerHealthPath = join(root, ".auto-forge", "worker-health.json");
    await mkdir(join(root, ".auto-forge"), { recursive: true });
    await writeFile(setupPath, `${JSON.stringify(setup, null, 2)}\n`);
    await writeWorkerHeartbeat(workerHealthPath, new Date("2026-04-28T00:00:00.000Z"));

    const report = await collectHealth({
      cwd: root,
      now: new Date("2026-04-28T00:00:10.000Z"),
      fetchImpl: async () => new Response("ok", { status: 200 }),
      env: {
        ...process.env,
        DATABASE_URL: "postgres://auto_forge:auto_forge@localhost:5432/auto_forge",
        AUTO_FORGE_PUBLIC_BASE_URL: "http://localhost:3000",
        AUTO_FORGE_WEB_HEALTH_URL: "http://localhost:5173/",
        OPENCLAW_BASE_URL: "http://localhost:8080",
        OPENCLAW_TOKEN_REF: "env:OPENCLAW_TOKEN",
        TELEGRAM_BOT_TOKEN_REF: "env:TELEGRAM_BOT_TOKEN",
        CODEX_AUTH_REF: "env:OPENAI_API_KEY",
        AUTO_FORGE_SETUP_PATH: setupPath,
        AUTO_FORGE_WORKER_HEALTH_PATH: workerHealthPath,
        CODEX_CLI_COMMAND: ""
      }
    });

    expect(report.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining(["api", "web", "worker", "database", "openclaw", "codex"])
    );
    expect(report.checks).toContainEqual(expect.objectContaining({ name: "api", status: "passed" }));
    expect(report.checks).toContainEqual(expect.objectContaining({ name: "web", status: "passed" }));
    expect(report.ok).toBe(true);
    expect(report.checks).toContainEqual(expect.objectContaining({ name: "setup", status: "passed" }));
    expect(report.checks).toContainEqual(expect.objectContaining({ name: "worker", status: "passed" }));
    expect(report.checks).toContainEqual(
      expect.objectContaining({ name: "codex", status: "passed", details: expect.objectContaining({ source: "managed" }) })
    );
    expect(JSON.stringify(report)).not.toContain("raw-token");
  });

  it("fails health when a custom Codex command override is not executable", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-forge-ops-codex-"));
    const report = await collectHealth({
      cwd: root,
      now: new Date("2026-04-28T00:00:10.000Z"),
      env: {
        ...process.env,
        DATABASE_URL: "postgres://auto_forge:auto_forge@localhost:5432/auto_forge",
        CODEX_CLI_COMMAND: "definitely-not-installed-codex-for-test"
      }
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        name: "codex",
        status: "failed",
        message: expect.stringContaining("CODEX_CLI_COMMAND")
      })
    );
  });

  it("maps container /data setup paths to the host Compose data directory for host CLI health", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-forge-ops-paths-"));
    const hostDataDir = join(root, ".auto-forge", "compose-data");

    const paths = resolveOpsPaths(
      {
        AUTO_FORGE_SETUP_PATH: "/data/setup.json",
        AUTO_FORGE_LOG_DIR: "/data/logs",
        AUTO_FORGE_WORKER_HEALTH_PATH: "/data/worker-health.json",
        AUTO_FORGE_HOST_DATA_DIR: hostDataDir
      },
      root
    );

    expect(paths.setupPath).toBe(join(hostDataDir, "setup.json"));
    expect(paths.logDir).toBe(join(hostDataDir, "logs"));
    expect(paths.workerHealthPath).toBe(join(hostDataDir, "worker-health.json"));
  });

  it("keeps container /data paths unchanged when running inside Compose", async () => {
    const paths = resolveOpsPaths(
      {
        AUTO_FORGE_DATA_DIR: "/data",
        AUTO_FORGE_SETUP_PATH: "/data/setup.json",
        AUTO_FORGE_LOG_DIR: "/data/logs",
        AUTO_FORGE_WORKER_HEALTH_PATH: "/data/worker-health.json"
      },
      "/app"
    );

    expect(paths.setupPath).toBe("/data/setup.json");
    expect(paths.logDir).toBe("/data/logs");
    expect(paths.workerHealthPath).toBe("/data/worker-health.json");
  });

  it("creates and dry-run restores a references-only backup", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-forge-backup-"));
    await mkdir(join(root, ".auto-forge"), { recursive: true });
    await writeFile(join(root, ".auto-forge", "setup.json"), `${JSON.stringify(setup, null, 2)}\n`);
    await writeFile(join(root, ".env.example"), "OPENCLAW_TOKEN_REF=env:OPENCLAW_TOKEN\n");
    await mkdir(join(root, "migrations"), { recursive: true });
    await writeFile(join(root, "migrations", "0001_initial.sql"), "-- migration\n");

    const backupPath = join(root, "backups", "bundle.json");
    const created = await createBackup({ cwd: root, output: backupPath, now: new Date("2026-04-28T00:00:00.000Z") });
    expect(created.manifest.secretsPolicy).toBe("references-only");

    const bundle = await readFile(backupPath, "utf8");
    expect(bundle).toContain("env:OPENCLAW_TOKEN");
    expect(bundle).not.toContain("raw-token");

    const restored = await restoreBackup({ cwd: root, input: backupPath, dryRun: true });
    expect(restored.dryRun).toBe(true);
    expect(restored.restored).toContain(join(root, ".auto-forge", "setup.json"));
  });

  it("discovers service logs for local, Docker Compose, and systemd paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-forge-service-logs-"));
    await mkdir(join(root, ".auto-forge", "logs", "services", "api"), { recursive: true });
    await writeFile(join(root, ".auto-forge", "logs", "services", "api", "api.log"), "started\n");

    const apiLogs = await discoverServiceLogs("api", { cwd: root });
    expect(apiLogs.sources).toContainEqual(
      expect.objectContaining({ kind: "local-npm", status: "available", path: join(root, ".auto-forge", "logs", "services", "api") })
    );
    expect(apiLogs.sources).toContainEqual(
      expect.objectContaining({ kind: "docker-compose", command: "docker compose logs api" })
    );
    expect(apiLogs.sources).toContainEqual(
      expect.objectContaining({ kind: "systemd", command: "journalctl -u auto-forge-api" })
    );

    const workerLogs = await discoverServiceLogs("worker", { cwd: root });
    expect(workerLogs.sources).toContainEqual(
      expect.objectContaining({ kind: "systemd", command: "journalctl -u auto-forge-worker" })
    );

    const webLogs = await discoverServiceLogs("web", { cwd: root });
    expect(webLogs.sources).toContainEqual(
      expect.objectContaining({ kind: "docker-compose", command: "docker compose logs web" })
    );
    expect(webLogs.sources).toContainEqual(expect.objectContaining({ kind: "local-npm", status: "not-created" }));

    const postgresLogs = await discoverServiceLogs("postgres", { cwd: root });
    expect(postgresLogs.sources).toContainEqual(
      expect.objectContaining({ kind: "docker-compose", command: "docker compose logs postgres" })
    );
  });

  it("dry-runs install documentation checks", async () => {
    const report = await runInstallDocumentationDryRun();
    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.name)).toContain("Docker Compose");
  });
});
