import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

interface Step {
  name: string;
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}

const tempDir = await mkdtemp(join(tmpdir(), "auto-forge-full-rebuild-"));
const backupPath = join(tempDir, "backup.json");
const composeEnv = {
  ...process.env,
  AUTO_FORGE_API_PORT: process.env.AUTO_FORGE_API_PORT ?? "3305",
  AUTO_FORGE_WEB_PORT: process.env.AUTO_FORGE_WEB_PORT ?? "5185"
};

const steps: Step[] = [
  { name: "fresh bootstrap", command: "bash", args: ["scripts/bootstrap.sh"] },
  { name: "automated verify suite", command: "npm", args: ["run", "verify"] },
  { name: "install surface dry run", command: "npm", args: ["run", "ops:install-check"] },
  { name: "runtime health", command: "npm", args: ["run", "ops:health"] },
  { name: "references-only backup", command: "npm", args: ["run", "ops:backup", "--", "--output", backupPath] },
  {
    name: "references-only restore dry run",
    command: "npm",
    args: ["run", "ops:restore", "--", "--input", backupPath, "--dry-run"]
  },
  { name: "recovery dry run", command: "npm", args: ["run", "ops:recover", "--", "--action", "list-stuck", "--dry-run"] },
  { name: "task log discovery", command: "npm", args: ["run", "auto-forge", "--", "logs", "--task", "phase-5-smoke"] },
  { name: "API service log discovery", command: "npm", args: ["run", "auto-forge", "--", "logs", "--service", "api"] },
  { name: "worker service log discovery", command: "npm", args: ["run", "auto-forge", "--", "logs", "--service", "worker"] },
  { name: "web service log discovery", command: "npm", args: ["run", "auto-forge", "--", "logs", "--service", "web"] },
  { name: "postgres service log discovery", command: "npm", args: ["run", "auto-forge", "--", "logs", "--service", "postgres"] },
  { name: "docker compose build", command: "docker", args: ["compose", "build"], env: composeEnv },
  {
    name: "docker compose up",
    command: "docker",
    args: ["compose", "up", "-d", "postgres", "api", "worker", "web"],
    env: composeEnv
  },
  {
    name: "docker compose smoke",
    command: "docker",
    args: ["compose", "-f", "docker-compose.yml", "-f", "docker-compose.smoke.yml", "run", "--rm", "smoke"],
    env: composeEnv
  }
];

const completed: string[] = [];

try {
  for (const step of steps) {
    await runStep(step);
    completed.push(step.name);
  }

  const backup = JSON.parse(await readFile(backupPath, "utf8")) as { manifest?: { secretsPolicy?: string } };
  if (backup.manifest?.secretsPolicy !== "references-only") {
    throw new Error("Backup did not preserve references-only secret policy");
  }

  console.log(JSON.stringify({ ok: true, completed, backupPath }, null, 2));
} finally {
  await runStep({
    name: "docker compose cleanup",
    command: "docker",
    args: ["compose", "down", "--remove-orphans"],
    env: composeEnv
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "docker compose cleanup failed");
  });
}

async function runStep(step: Step): Promise<void> {
  console.log(`\n[full-rebuild] ${step.name}: ${step.command} ${step.args.join(" ")}`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(step.command, step.args, {
      cwd: process.cwd(),
      env: step.env ?? process.env,
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${step.name} failed with exit code ${code ?? 1}`));
    });
  });
}
