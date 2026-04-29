import { chmod, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  GitHubSshKeyManager,
  parseGitHubRemote,
  redactSensitiveKeyMaterial,
  type CommandInvocation
} from "../packages/ops/src/index.js";
import type { RepoRegistration } from "../packages/core/src/index.js";

describe("GitHub SSH key manager", () => {
  it("generates per-repo Ed25519 keys with restrictive private-key mode", async () => {
    const keyRoot = await mkdtemp(join(tmpdir(), "auto-forge-ssh-keys-"));
    const manager = new GitHubSshKeyManager({ keyRoot });

    const info = await manager.createKey(repoFixture());

    expect(info.publicKey).toMatch(/^ssh-ed25519 /);
    expect(info.fingerprint).toMatch(/^SHA256:/);
    expect(info.privateKeyMode).toBe("0600");
    expect(info.privateKeyPath.startsWith(keyRoot)).toBe(true);
  });

  it("constructs isolated git SSH commands for read and dry-run push checks", async () => {
    const keyRoot = await mkdtemp(join(tmpdir(), "auto-forge-git-command-"));
    const calls: CommandInvocation[] = [];
    const manager = new GitHubSshKeyManager({
      keyRoot,
      commandRunner: async (invocation) => {
        calls.push(invocation);
        return { stdout: "", stderr: "" };
      }
    });
    await seedKey(manager, repoFixture());

    await expect(manager.testGitAccess(repoFixture())).resolves.toEqual(
      expect.objectContaining({ ok: true, pushDryRunOk: true })
    );

    expect(calls).toEqual([
      expect.objectContaining({ command: "git", args: ["ls-remote", "--heads", "git@github.com:owner/repo.git"] }),
      expect.objectContaining({
        command: "git",
        args: ["-C", "/tmp/repo", "push", "--dry-run", "git@github.com:owner/repo.git", "HEAD:main"]
      })
    ]);
    expect(calls[0]?.options?.env?.GIT_SSH_COMMAND).toContain("-o IdentitiesOnly=yes");
    expect(calls[0]?.options?.env?.GIT_SSH_COMMAND).toContain("-i ");
  });

  it("creates GitHub deploy keys as read-only unless write access is explicit", async () => {
    const keyRoot = await mkdtemp(join(tmpdir(), "auto-forge-github-key-"));
    const requests: Array<{ url: string; body: unknown; authorization: string | null }> = [];
    const manager = new GitHubSshKeyManager({
      keyRoot,
      env: { AUTO_FORGE_GITHUB_TOKEN: "test-token" },
      commandRunner: async () => ({ stdout: "256 SHA256:testfingerprint auto-forge (ED25519)\n", stderr: "" }),
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          body: JSON.parse(String(init?.body)),
          authorization: new Headers(init?.headers).get("authorization")
        });
        return new Response(JSON.stringify({ id: 12, html_url: "https://github.com/owner/repo/settings/keys/12" }), {
          status: 201,
          headers: { "content-type": "application/json" }
        });
      }
    });
    await seedKey(manager, repoFixture());

    await manager.addGitHubDeployKey(repoFixture(), { writeAccess: false });
    await manager.addGitHubDeployKey(repoFixture(), { writeAccess: true });

    expect(requests[0]).toEqual(
      expect.objectContaining({
        url: "https://api.github.com/repos/owner/repo/keys",
        authorization: "Bearer test-token",
        body: expect.objectContaining({ read_only: true, key: expect.stringMatching(/^ssh-ed25519 /) })
      })
    );
    expect(requests[1]?.body).toEqual(expect.objectContaining({ read_only: false }));
  });

  it("redacts private-key material from errors", () => {
    const leaked = [
      "git failed:",
      "-----BEGIN OPENSSH PRIVATE KEY-----",
      "b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtz",
      "-----END OPENSSH PRIVATE KEY-----"
    ].join("\n");

    expect(redactSensitiveKeyMaterial(leaked)).toBe("git failed:\n[REDACTED_PRIVATE_KEY]");
  });

  it("parses supported GitHub remote URL forms", () => {
    expect(parseGitHubRemote("git@github.com:owner/repo.git")).toEqual({ owner: "owner", repo: "repo" });
    expect(parseGitHubRemote("ssh://git@github.com/owner/repo.git")).toEqual({ owner: "owner", repo: "repo" });
    expect(parseGitHubRemote("https://github.com/owner/repo.git")).toEqual({ owner: "owner", repo: "repo" });
  });
});

function repoFixture(): RepoRegistration {
  return {
    id: "repo:app",
    name: "app",
    repoPath: "/tmp/repo",
    defaultBranch: "main",
    sshRemote: "git@github.com:owner/repo.git",
    isPaused: false,
    createdAt: new Date("2026-04-29T00:00:00Z")
  };
}

async function seedKey(manager: GitHubSshKeyManager, repo: RepoRegistration): Promise<void> {
  const paths = manager.pathsFor(repo);
  await mkdir(dirname(paths.privateKeyPath), { recursive: true, mode: 0o700 });
  await writeFile(paths.privateKeyPath, "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----\n");
  await writeFile(paths.publicKeyPath, "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITestKey auto-forge\n");
  await chmod(paths.privateKeyPath, 0o600);
}
