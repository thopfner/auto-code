import { describe, expect, it } from "vitest";
import { CodexCliRunner } from "../packages/adapters/src/index.js";
import type { SecretResolver } from "../packages/adapters/src/secrets.js";

const emptySecrets: SecretResolver = {
  async resolve() {
    return undefined;
  }
};

describe("Codex CLI runner adapter", () => {
  it("passes a local Codex smoke check without invoking a model run", async () => {
    const runner = new CodexCliRunner(emptySecrets);
    const smoke = await runner.smoke();

    expect(smoke.ok).toBe(true);
    expect(smoke.version).toContain("codex");
  });
});
