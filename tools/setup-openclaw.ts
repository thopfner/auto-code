import { bootstrapManagedOpenClawWorkspace } from "../packages/ops/src/openclaw-bootstrap.js";

interface CliOptions {
  workspaceDir: string;
  openClawCommand: string;
  allowMissingCli: boolean;
}

const options = parseArgs(process.argv.slice(2));
const result = await bootstrapManagedOpenClawWorkspace({
  workspaceDir: options.workspaceDir,
  openClawCommand: options.openClawCommand,
  allowMissingCli: options.allowMissingCli
});

console.log(JSON.stringify({ ok: true, ...result }, null, 2));

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    workspaceDir: process.env.OPENCLAW_WORKSPACE_DIR ?? "/root/.openclaw/workspace",
    openClawCommand: process.env.OPENCLAW_CLI_COMMAND ?? "openclaw",
    allowMissingCli: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--workspace-dir") {
      options.workspaceDir = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--openclaw-command") {
      options.openClawCommand = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--allow-missing-cli") {
      options.allowMissingCli = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unsupported argument: ${arg}`);
    }
  }

  return options;
}

function readValue(args: string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function printHelp(): void {
  console.log(`Managed OpenClaw bootstrap

Usage:
  tsx tools/setup-openclaw.ts [--workspace-dir <path>] [--openclaw-command <command>] [--allow-missing-cli]
`);
}
