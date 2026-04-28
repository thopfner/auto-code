import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ControllerSetup } from "../../core/src/index.js";
import { resolveOpsPaths, type OpsPaths } from "./paths.js";

export interface BackupManifest {
  format: "auto-forge-backup-v1";
  createdAt: string;
  sourceRoot: string;
  includes: Array<"setup" | "env_example" | "migrations_manifest">;
  secretsPolicy: "references-only";
  files: Array<{ name: string; present: boolean; bytes?: number }>;
}

export interface BackupBundle {
  manifest: BackupManifest;
  setup?: ControllerSetup;
  envExample?: string;
  migrations: string[];
}

export interface BackupOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  paths?: OpsPaths;
  output?: string;
  now?: Date;
  dryRun?: boolean;
}

export interface RestoreOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  paths?: OpsPaths;
  input: string;
  dryRun?: boolean;
}

export async function createBackup(options: BackupOptions = {}): Promise<{ path: string; manifest: BackupManifest }> {
  const paths = options.paths ?? resolveOpsPaths(options.env, options.cwd);
  const now = options.now ?? new Date();
  const bundle = await buildBackupBundle(paths, now);
  const output =
    options.output ?? join(paths.backupDir, `auto-forge-backup-${now.toISOString().replaceAll(":", "-")}.json`);

  if (!options.dryRun) {
    await mkdir(paths.backupDir, { recursive: true });
    await writeFile(output, `${JSON.stringify(bundle, null, 2)}\n`, { mode: 0o600 });
  }

  return { path: output, manifest: bundle.manifest };
}

export async function restoreBackup(options: RestoreOptions): Promise<{ restored: string[]; dryRun: boolean }> {
  const paths = options.paths ?? resolveOpsPaths(options.env, options.cwd);
  const bundle = JSON.parse(await readFile(options.input, "utf8")) as BackupBundle;
  validateBundle(bundle);
  const restored: string[] = [];

  if (bundle.setup) {
    restored.push(paths.setupPath);
    if (!options.dryRun) {
      await mkdir(dirname(paths.setupPath), { recursive: true });
      await writeFile(paths.setupPath, `${JSON.stringify(bundle.setup, null, 2)}\n`, { mode: 0o600 });
    }
  }

  return { restored, dryRun: Boolean(options.dryRun) };
}

async function buildBackupBundle(paths: OpsPaths, now: Date): Promise<BackupBundle> {
  const setup = await readOptionalJson<ControllerSetup>(paths.setupPath);
  const envExample = await readOptionalText(join(paths.rootDir, ".env.example"));
  const migrations = await listMigrationManifest(paths.rootDir);
  const files = [
    await fileManifest("setup.json", paths.setupPath),
    await fileManifest(".env.example", join(paths.rootDir, ".env.example"))
  ];

  return {
    manifest: {
      format: "auto-forge-backup-v1",
      createdAt: now.toISOString(),
      sourceRoot: paths.rootDir,
      includes: ["setup", "env_example", "migrations_manifest"],
      secretsPolicy: "references-only",
      files
    },
    setup,
    envExample,
    migrations
  };
}

async function readOptionalJson<T>(path: string): Promise<T | undefined> {
  const content = await readOptionalText(path);
  return content ? (JSON.parse(content) as T) : undefined;
}

async function readOptionalText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function listMigrationManifest(rootDir: string): Promise<string[]> {
  const migration = await readOptionalText(join(rootDir, "migrations/0001_initial.sql"));
  return migration ? ["migrations/0001_initial.sql"] : [];
}

async function fileManifest(name: string, path: string): Promise<{ name: string; present: boolean; bytes?: number }> {
  try {
    const result = await stat(path);
    return { name, present: true, bytes: result.size };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { name, present: false };
    }
    throw error;
  }
}

function validateBundle(bundle: BackupBundle): void {
  if (bundle.manifest?.format !== "auto-forge-backup-v1") {
    throw new Error(`Unsupported backup format: ${String(bundle.manifest?.format)}`);
  }
  if (bundle.manifest.secretsPolicy !== "references-only") {
    throw new Error("Refusing to restore backup without references-only secret policy");
  }
  const openClawAuthRef = bundle.setup?.openClaw.authRef ?? bundle.setup?.openClaw.tokenRef;
  if (openClawAuthRef && !String(openClawAuthRef).includes(":")) {
    throw new Error("Refusing to restore setup with invalid OpenClaw auth reference");
  }
}
