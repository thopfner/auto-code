# Managed Codex CLI Problem Framing

Updated: `2026-04-28T21:39:54Z`

## Objective

Make Codex CLI a product-managed runtime dependency installed by Auto Forge bootstrap/build, not a manual operator prerequisite.

The target user is a SaaS owner deploying Auto Forge Controller and its Forge skillset for customers. Customers will eventually operate setup through browser or chat flows and must not be expected to SSH into a VPS to install Codex by hand.

## Desired Outcome

A fresh VPS clone can run:

```bash
scripts/bootstrap.sh
npm run verify
npm run full-rebuild
```

without a preinstalled global `codex` command.

The API, worker, Docker Compose services, setup wizard, health check, and live smoke path must all use the same product-managed Codex binary by default. `CODEX_CLI_COMMAND` remains an explicit override for operators who intentionally provide a different binary.

## Non-Goals

- Do not build the future browser/chat onboarding wizard in this revision.
- Do not remove API-key based unattended Codex auth.
- Do not make OAuth/manual login the default automation path.
- Do not require customers to run `npm install -g @openai/codex`.
- Do not weaken Codex runner smoke coverage by skipping the real local binary check.

## Known Constraints

- Repo runtime is TypeScript/Node with npm and Docker Compose support.
- The worker currently runs `CodexCliRunner`, which defaults to spawning `codex`.
- The Docker image currently installs only repo dependencies with `npm ci`.
- Final live smoke still needs real `OPENAI_API_KEY` for unattended Codex execution.
- Secrets must remain references-only in setup JSON and backups.

## Invariants

- The controller owns automation behavior; a missing global CLI must not be a customer action item.
- `CODEX_CLI_COMMAND` may override the managed binary only when explicitly set.
- Auth remains separate from installation. Installing the Codex CLI must not imply raw key persistence outside the selected env file or operator environment.
- The final product must remain deployable through both local npm and Docker Compose paths.

## Relevant Code Surfaces

- `package.json`
- `package-lock.json`
- `scripts/bootstrap.sh`
- `Dockerfile`
- `.env.example`
- `packages/adapters/src/codex-runner.ts`
- `packages/ops/src/health.ts`
- `apps/cli/src/index.ts`
- `tools/live-external-smoke.ts`
- `tests/codex-runner.test.ts`
- `tests/ops.test.ts`
- `docs/deployment/README.md`
- `docs/deployment/local.md`
- `docs/deployment/vps.md`
- `docs/agent-memory/CURRENT_STATE.md`
- `docs/agent-memory/TESTING.md`

## Research Summary

Official OpenAI Help Center guidance currently documents Codex CLI installation through npm as `npm install -g @openai/codex`, and Codex CLI auth through either `OPENAI_API_KEY` or `codex login`.

The npm registry currently publishes `@openai/codex@0.125.0` with a `codex` binary exposed from `bin/codex.js`, matching the local version already used in this repo's prior QA evidence.

Sources:

- `https://help.openai.com/en/articles/11096431-openai-codex-ci-getting-started`
- `https://help.openai.com/en/articles/11381614-codex-codex-andsign-in-with-chatgpt`
- `npm view @openai/codex@0.125.0 version bin engines --json`

## Important Unknowns

- Whether future Codex SDK or MCP integration should replace CLI execution. That is out of scope for this revision because the current product and tests already target `CodexCliRunner`.
- Whether the browser wizard will expose advanced Codex auth options. This revision keeps the server-side dependency contract correct so the future UI can build on it.
