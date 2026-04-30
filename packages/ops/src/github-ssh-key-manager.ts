import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import type { RepoRegistration } from "../../core/src/index.js";

const execFileAsync = promisify(execFile);

export interface CommandInvocation {
  command: string;
  args: string[];
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  };
}

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export type CommandRunner = (invocation: CommandInvocation) => Promise<CommandResult>;

export interface GitHubSshKeyManagerOptions {
  keyRoot: string;
  commandRunner?: CommandRunner;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  githubApiBaseUrl?: string;
}

export interface RepoSshKeyInfo {
  repoId: string;
  alias: string;
  privateKeyPath: string;
  publicKeyPath: string;
  publicKey: string;
  fingerprint: string;
  privateKeyMode: string;
}

export interface GitAccessCheck {
  ok: boolean;
  remote: string;
  message: string;
}

export interface GitPushDryRunCheck extends GitAccessCheck {
  pushDryRunOk: boolean;
}

export interface GitHubDeployKeyResult {
  title: string;
  readOnly: boolean;
  htmlUrl?: string;
  id?: number;
}

export class GitHubSshKeyManager {
  private readonly commandRunner: CommandRunner;
  private readonly fetchImpl: typeof fetch;
  private readonly env: NodeJS.ProcessEnv;
  private readonly githubApiBaseUrl: string;
  private readonly keyRoot: string;

  constructor(private readonly options: GitHubSshKeyManagerOptions) {
    this.commandRunner = options.commandRunner ?? defaultCommandRunner;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.env = options.env ?? process.env;
    this.githubApiBaseUrl = options.githubApiBaseUrl ?? "https://api.github.com";
    this.keyRoot = resolve(options.keyRoot);
  }

  async createKey(repo: RepoRegistration): Promise<RepoSshKeyInfo> {
    const paths = this.pathsFor(repo);
    await mkdir(dirname(paths.privateKeyPath), { recursive: true, mode: 0o700 });
    await chmod(dirname(paths.privateKeyPath), 0o700);

    await this.commandRunner({
      command: "ssh-keygen",
      args: ["-t", "ed25519", "-C", `auto-forge:${repo.id}`, "-N", "", "-f", paths.privateKeyPath]
    });

    await chmod(paths.privateKeyPath, 0o600);
    await chmod(paths.publicKeyPath, 0o644);
    return this.describeKey(repo);
  }

  async describeKey(repo: RepoRegistration): Promise<RepoSshKeyInfo> {
    const paths = this.pathsFor(repo);
    const publicKey = (await readFile(paths.publicKeyPath, "utf8")).trim();
    const fingerprint = await this.fingerprint(paths.publicKeyPath);
    const privateKeyMode = await fileMode(paths.privateKeyPath);
    return {
      repoId: repo.id,
      alias: repo.name,
      privateKeyPath: paths.privateKeyPath,
      publicKeyPath: paths.publicKeyPath,
      publicKey,
      fingerprint,
      privateKeyMode
    };
  }

  async testReadAccess(repo: RepoRegistration): Promise<GitAccessCheck> {
    const remote = toGitHubSshRemote(await this.resolveRemote(repo));
    const paths = this.pathsFor(repo);
    await this.assertPrivateKeyExists(paths.privateKeyPath);
    await this.commandRunner({
      command: "git",
      args: ["ls-remote", "--heads", remote],
      options: { env: this.gitEnv(paths.privateKeyPath) }
    });
    return {
      ok: true,
      remote,
      message: `SSH read access verified for ${repo.name}.`
    };
  }

  async testGitAccess(repo: RepoRegistration): Promise<GitPushDryRunCheck> {
    const remote = toGitHubSshRemote(await this.resolveRemote(repo));
    const paths = this.pathsFor(repo);
    await this.assertPrivateKeyExists(paths.privateKeyPath);
    await this.commandRunner({
      command: "git",
      args: ["ls-remote", "--heads", remote],
      options: { env: this.gitEnv(paths.privateKeyPath) }
    });
    await this.commandRunner({
      command: "git",
      args: ["-C", repo.repoPath, "push", "--dry-run", remote, `HEAD:${repo.defaultBranch}`],
      options: { env: this.gitEnv(paths.privateKeyPath) }
    });
    return {
      ok: true,
      pushDryRunOk: true,
      remote,
      message: `SSH read access and dry-run push verified for ${repo.name}.`
    };
  }

  async addGitHubDeployKey(repo: RepoRegistration, options: { writeAccess: boolean }): Promise<GitHubDeployKeyResult> {
    const keyInfo = await this.describeKey(repo);
    const remote = await this.resolveRemote(repo);
    const githubRepo = parseGitHubRemote(remote);
    const token = this.env.AUTO_FORGE_GITHUB_TOKEN ?? this.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GitHub deploy-key API requires AUTO_FORGE_GITHUB_TOKEN or GITHUB_TOKEN.");
    }

    const title = `Auto Forge ${repo.name} ${keyInfo.fingerprint}`;
    const response = await this.fetchImpl(`${this.githubApiBaseUrl}/repos/${githubRepo.owner}/${githubRepo.repo}/keys`, {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-github-api-version": "2026-03-10"
      },
      body: JSON.stringify({
        title,
        key: keyInfo.publicKey,
        read_only: !options.writeAccess
      })
    });

    const payload = (await response.json().catch(() => undefined)) as { id?: number; html_url?: string; message?: string } | undefined;
    if (!response.ok) {
      throw new Error(`GitHub deploy-key creation failed: ${payload?.message ?? response.statusText}`);
    }

    return {
      title,
      readOnly: !options.writeAccess,
      id: payload?.id,
      htmlUrl: payload?.html_url
    };
  }

  redactedError(error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(redactSensitiveKeyMaterial(message));
  }

  pathsFor(repo: RepoRegistration): { privateKeyPath: string; publicKeyPath: string } {
    const repoDir = join(this.keyRoot, repoKeyDirectory(repo));
    assertPathInside(this.keyRoot, repoDir);
    const privateKeyPath = join(repoDir, "id_ed25519");
    return {
      privateKeyPath,
      publicKeyPath: `${privateKeyPath}.pub`
    };
  }

  private async fingerprint(publicKeyPath: string): Promise<string> {
    const result = await this.commandRunner({
      command: "ssh-keygen",
      args: ["-lf", publicKeyPath]
    });
    const [, fingerprint] = result.stdout.trim().split(/\s+/);
    if (!fingerprint) {
      throw new Error("Unable to read SSH public key fingerprint.");
    }
    return fingerprint;
  }

  private async resolveRemote(repo: RepoRegistration): Promise<string> {
    if (repo.sshRemote) {
      return repo.sshRemote;
    }
    const result = await this.commandRunner({
      command: "git",
      args: ["-C", repo.repoPath, "remote", "get-url", "origin"]
    });
    const remote = result.stdout.trim();
    if (!remote) {
      throw new Error(`Repo ${repo.name} has no sshRemote and no origin remote.`);
    }
    return remote;
  }

  private gitEnv(privateKeyPath: string): NodeJS.ProcessEnv {
    return {
      ...this.env,
      GIT_SSH_COMMAND: `ssh -i ${shellQuote(privateKeyPath)} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`
    };
  }

  private async assertPrivateKeyExists(privateKeyPath: string): Promise<void> {
    const mode = await fileMode(privateKeyPath);
    if (mode !== "0600") {
      throw new Error(`Private SSH key must be mode 0600, found ${mode}.`);
    }
  }
}

export function formatKeyInfoForOperator(info: RepoSshKeyInfo): string {
  return [
    `Repo key: ${info.alias}`,
    `Fingerprint: ${info.fingerprint}`,
    `Public key:`,
    info.publicKey,
    "Private key stays on the controller disk and is never sent over Telegram.",
    "GitHub manual setup: Repository Settings -> Deploy keys -> Add deploy key. Paste the public key. Enable write access when Auto Forge must push commits for this repo.",
    `Then run /repo git-test ${info.alias}.`
  ].join("\n");
}

export function toGitHubSshRemote(remote: string): string {
  const parsed = parseGitHubRemote(remote);
  return `git@github.com:${parsed.owner}/${parsed.repo}.git`;
}

export function parseGitHubRemote(remote: string): { owner: string; repo: string } {
  const trimmed = remote.trim();
  const scpLike = /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/.exec(trimmed);
  if (scpLike?.[1] && scpLike[2]) {
    return { owner: scpLike[1], repo: stripGitSuffix(scpLike[2]) };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("GitHub deploy-key API only supports github.com repository remotes.");
  }
  if (parsed.hostname !== "github.com") {
    throw new Error("GitHub deploy-key API only supports github.com repository remotes.");
  }
  const [owner, repo] = parsed.pathname.replace(/^\/+/, "").split("/");
  if (!owner || !repo) {
    throw new Error("GitHub repository remote must include owner and repo.");
  }
  return { owner, repo: stripGitSuffix(repo) };
}

export function redactSensitiveKeyMaterial(value: string): string {
  return value
    .replace(/-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]")
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]")
    .replace(/\b[A-Za-z0-9+/]{80,}={0,2}\b/g, "[REDACTED_LONG_SECRET]");
}

async function defaultCommandRunner(invocation: CommandInvocation): Promise<CommandResult> {
  const result = await execFileAsync(invocation.command, invocation.args, invocation.options);
  return {
    stdout: String(result.stdout),
    stderr: String(result.stderr)
  };
}

async function fileMode(path: string): Promise<string> {
  const stats = await stat(path);
  return (stats.mode & 0o777).toString(8).padStart(4, "0");
}

function repoKeyDirectory(repo: RepoRegistration): string {
  const normalized = `${repo.id}-${repo.name}`.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "").slice(0, 80) || "repo";
}

function assertPathInside(root: string, targetPath: string): void {
  const distance = relative(root, targetPath);
  if (distance.startsWith("..")) {
    throw new Error("SSH key path escaped the configured key root.");
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function stripGitSuffix(value: string): string {
  return value.endsWith(".git") ? value.slice(0, -4) : value;
}
