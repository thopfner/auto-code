import { resolve } from "node:path";

export interface OpsPaths {
  rootDir: string;
  dataDir: string;
  setupPath: string;
  backupDir: string;
  logDir: string;
  workerHealthPath: string;
}

export function resolveOpsPaths(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): OpsPaths {
  const rootDir = resolve(cwd);
  const dataDir = resolve(rootDir, env.AUTO_FORGE_DATA_DIR ?? ".auto-forge");
  return {
    rootDir,
    dataDir,
    setupPath: resolve(rootDir, env.AUTO_FORGE_SETUP_PATH ?? ".auto-forge/setup.json"),
    backupDir: resolve(rootDir, env.AUTO_FORGE_BACKUP_DIR ?? "backups"),
    logDir: resolve(rootDir, env.AUTO_FORGE_LOG_DIR ?? ".auto-forge/logs"),
    workerHealthPath: resolve(rootDir, env.AUTO_FORGE_WORKER_HEALTH_PATH ?? ".auto-forge/worker-health.json")
  };
}
