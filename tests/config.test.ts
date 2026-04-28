import { describe, expect, it } from "vitest";
import { loadRuntimeConfig } from "../packages/config/src/index.js";

describe("runtime config", () => {
  it("accepts secret references instead of committed secret values", () => {
    const config = loadRuntimeConfig({
      NODE_ENV: "test",
      PORT: "3000",
      DATABASE_URL: "postgres://auto_forge:auto_forge@localhost:5432/auto_forge",
      AUTO_FORGE_PUBLIC_BASE_URL: "http://localhost:3000",
      OPENCLAW_BASE_URL: "http://localhost:8080",
      OPENCLAW_SETUP_MODE: "detect-existing",
      TELEGRAM_BOT_TOKEN_REF: "env:TELEGRAM_BOT_TOKEN",
      CODEX_AUTH_REF: "env:OPENAI_API_KEY"
    });

    expect(config.TELEGRAM_BOT_TOKEN_REF).toBe("env:TELEGRAM_BOT_TOKEN");
    expect(config.OPENCLAW_TOKEN_REF).toBeUndefined();
  });

  it("rejects raw secret-looking values", () => {
    expect(() =>
      loadRuntimeConfig({
        DATABASE_URL: "postgres://auto_forge:auto_forge@localhost:5432/auto_forge",
        AUTO_FORGE_PUBLIC_BASE_URL: "http://localhost:3000",
        OPENCLAW_BASE_URL: "http://localhost:8080",
        OPENCLAW_AUTH_REF: "plain-token",
        TELEGRAM_BOT_TOKEN_REF: "env:TELEGRAM_BOT_TOKEN",
        CODEX_AUTH_REF: "env:OPENAI_API_KEY"
      })
    ).toThrow();
  });
});
