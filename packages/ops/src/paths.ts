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
  const dataDir = resolveOpsPath(rootDir, env, env.AUTO_FORGE_DATA_DIR ?? ".auto-forge");
  return {
    rootDir,
    dataDir,
    setupPath: resolveOpsPath(rootDir, env, env.AUTO_FORGE_SETUP_PATH ?? ".auto-forge/setup.json"),
    backupDir: resolveOpsPath(rootDir, env, env.AUTO_FORGE_BACKUP_DIR ?? "backups"),
    logDir: resolveOpsPath(rootDir, env, env.AUTO_FORGE_LOG_DIR ?? ".auto-forge/logs"),
    workerHealthPath: resolveOpsPath(rootDir, env, env.AUTO_FORGE_WORKER_HEALTH_PATH ?? ".auto-forge/worker-health.json")
  };
}

function resolveOpsPath(rootDir: string, env: NodeJS.ProcessEnv, rawPath: string): string {
  const containerDataDir = resolve("/", env.AUTO_FORGE_CONTAINER_DATA_DIR ?? "/data");
  const runtimeDataDir = resolve(rootDir, env.AUTO_FORGE_DATA_DIR ?? ".auto-forge");
  const candidate = resolve(rootDir, rawPath);
  const runtimeContext = env.AUTO_FORGE_RUNTIME_CONTEXT ?? env.AUTO_FORGE_HEALTH_CONTEXT;
  const shouldMapContainerPath = runtimeContext === "host" || (!runtimeContext && (runtimeDataDir !== containerDataDir || env.AUTO_FORGE_HOST_DATA_DIR));

  if (shouldMapContainerPath && isUnderPath(candidate, containerDataDir)) {
    const hostDataDir = resolve(rootDir, env.AUTO_FORGE_HOST_DATA_DIR ?? ".auto-forge/compose-data");
    const relative = candidate.slice(containerDataDir.length).replace(/^\/+/, "");
    return resolve(hostDataDir, relative);
  }

  return candidate;
}

function isUnderPath(candidate: string, parent: string): boolean {
  return candidate === parent || candidate.startsWith(`${parent}/`);
}
