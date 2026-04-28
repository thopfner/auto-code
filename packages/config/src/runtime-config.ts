import { z } from "zod";

const secretRefSchema = z.string().regex(/^(env|secret):[A-Z0-9_./-]+$/i, "Use env:NAME or secret:name references");

export const runtimeConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  AUTO_FORGE_PUBLIC_BASE_URL: z.string().url(),
  OPENCLAW_BASE_URL: z.string().url(),
  OPENCLAW_TOKEN_REF: secretRefSchema,
  OPENCLAW_AGENT_HOOK_PATH: z.string().regex(/^\/[a-z0-9/_-]+$/i).default("/hooks/agent"),
  TELEGRAM_BOT_TOKEN_REF: secretRefSchema,
  TELEGRAM_TEST_CHAT_ID: z.string().min(1).optional(),
  CODEX_AUTH_REF: secretRefSchema
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

export function loadRuntimeConfig(env: NodeJS.ProcessEnv): RuntimeConfig {
  return runtimeConfigSchema.parse(env);
}
