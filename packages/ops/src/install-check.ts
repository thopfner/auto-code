import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { resolveOpsPaths } from "./paths.js";

export interface InstallCheck {
  name: string;
  status: "passed" | "failed";
  message: string;
}

export interface InstallCheckReport {
  ok: boolean;
  rootDir: string;
  checks: InstallCheck[];
}

export async function runInstallDocumentationDryRun(
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<InstallCheckReport> {
  const paths = resolveOpsPaths(options.env, options.cwd);
  const checks: InstallCheck[] = [];

  checks.push(await fileCheck("README deployment section", join(paths.rootDir, "docs/deployment/README.md")));
  checks.push(await fileCheck("local install guide", join(paths.rootDir, "docs/deployment/local.md")));
  checks.push(await fileCheck("VPS install guide", join(paths.rootDir, "docs/deployment/vps.md")));
  checks.push(await fileCheck("recovery runbook", join(paths.rootDir, "docs/deployment/recovery.md")));
  checks.push(await fileCheck("Docker Compose", join(paths.rootDir, "docker-compose.yml")));
  checks.push(await fileCheck("systemd API unit", join(paths.rootDir, "systemd/auto-forge-api.service")));
  checks.push(await packageScriptCheck(paths.rootDir, "ops:health"));
  checks.push(await packageScriptCheck(paths.rootDir, "ops:backup"));
  checks.push(await packageScriptCheck(paths.rootDir, "full-rebuild"));
  checks.push(await packageScriptCheck(paths.rootDir, "live:smoke"));

  return {
    ok: checks.every((check) => check.status === "passed"),
    rootDir: paths.rootDir,
    checks
  };
}

async function fileCheck(name: string, path: string): Promise<InstallCheck> {
  try {
    await access(path, constants.R_OK);
    return { name, status: "passed", message: `${path} is present` };
  } catch {
    return { name, status: "failed", message: `${path} is missing or not readable` };
  }
}

async function packageScriptCheck(rootDir: string, scriptName: string): Promise<InstallCheck> {
  try {
    const pkg = JSON.parse(await readFile(join(rootDir, "package.json"), "utf8")) as { scripts?: Record<string, string> };
    return pkg.scripts?.[scriptName]
      ? { name: `package script ${scriptName}`, status: "passed", message: `npm run ${scriptName} is documented` }
      : { name: `package script ${scriptName}`, status: "failed", message: `npm run ${scriptName} is missing` };
  } catch (error) {
    return {
      name: `package script ${scriptName}`,
      status: "failed",
      message: error instanceof Error ? error.message : "package.json read failed"
    };
  }
}
