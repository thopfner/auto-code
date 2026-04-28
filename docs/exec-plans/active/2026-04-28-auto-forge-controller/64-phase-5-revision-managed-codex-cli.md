# Phase 5 Revision - Managed Codex CLI Runtime

Execution mode: `FINAL_SHIPGATE_REVISION`
Validation level: `FULL_REBUILD`
Stop gate: `QA_CHECKPOINT`

## Why This Revision Exists

A fresh customer VPS failed `npm run verify` because `tests/codex-runner.test.ts` expected a global `codex` binary and the host did not have one:

```text
Error: spawn codex ENOENT
```

That is unacceptable for the product model. Auto Forge Controller is a deployable SaaS-style controller and future browser/chat setup flow. Customers must not SSH into the VPS to install Codex manually.

## Production-Grade Acceptance Bar

The bar comes from repo conventions plus official OpenAI Codex CLI npm guidance and current npm package metadata.

Ship-ready means:

- `scripts/bootstrap.sh` plus `npm ci` installs the Codex CLI needed by the product.
- Docker Compose images include the same Codex CLI binary through the normal dependency install.
- Runtime, health, setup, tests, and live smoke resolve a product-managed Codex binary by default.
- `CODEX_CLI_COMMAND` remains an explicit override for advanced operators.
- Docs no longer list manually installing Codex CLI as a fresh-VPS prerequisite.
- Tests do not skip the real local Codex binary check just to pass on a fresh server.
- Codex auth remains separate and references-only; this revision installs the CLI, not credentials.

Forbidden shortcuts:

- Do not add `npm install -g @openai/codex` as the primary solution.
- Do not tell the operator to install Codex manually.
- Do not remove or weaken the Codex smoke test.
- Do not make Docker and host installs diverge.
- Do not persist raw `OPENAI_API_KEY` outside the ignored selected env file or process environment.

## Required Fix

Implement repo-managed Codex CLI installation and resolution.

Required behavior:

- Add `@openai/codex@0.125.0` as a normal dependency so `npm ci` installs it.
- Add a shared Codex binary resolver used by runtime and health paths.
- Resolver order:
  1. explicit `CodexCliRunnerOptions.codexBin`
  2. explicit `CODEX_CLI_COMMAND`
  3. repo-local `node_modules/.bin/codex`
- If none is executable, fail with a clear product-managed bootstrap message that tells the operator to rerun `scripts/bootstrap.sh` or rebuild the image, not to manually install global Codex.
- Keep `OPENAI_API_KEY`/`CODEX_AUTH_REF` behavior unchanged except for clearer messaging where needed.

## Risky Seam Inventory

- Runtime dependency seam: host npm, Docker image, tests, API, worker, setup, and live smoke must all use the same managed binary contract.
- External provider contract: Codex CLI version and command flags must remain compatible with the existing runner contract.
- Secrets seam: installing CLI must not blur the line between binary installation and Codex auth.
- Test truth seam: tests must prove fresh bootstrap works without global `codex`, not mask the absence of Codex.

## Edge-State Matrix

Handle:

- Fresh host after clone and `scripts/bootstrap.sh`, with no global `codex`.
- Docker image built by `docker compose build`, with no host `codex` mounted into the container.
- Operator sets `CODEX_CLI_COMMAND` to a custom binary.
- Explicit `CodexCliRunnerOptions.codexBin` is used in tests.
- Local managed binary missing because dependencies were not installed.
- Codex auth missing while binary exists.

Fail closed when:

- the managed binary is missing after bootstrap/build
- a custom override path is configured but not executable
- a live runner smoke lacks required `OPENAI_API_KEY`

Do not fail final deterministic tests just because a global `codex` is absent.

## Implementation Targets

Exact files:

- `package.json`
- `package-lock.json`
- `packages/adapters/src/codex-runner.ts`
- `packages/ops/src/health.ts`
- `tests/codex-runner.test.ts`
- `tests/ops.test.ts`
- `scripts/bootstrap.sh`
- `Dockerfile`
- `.env.example`
- `docs/deployment/README.md`
- `docs/deployment/local.md`
- `docs/deployment/vps.md`
- `docs/agent-memory/CURRENT_STATE.md`
- `docs/agent-memory/TESTING.md`
- active brief reports and automation files

Likely files if shared resolver placement requires an export:

- `packages/adapters/src/index.ts`
- `packages/ops/src/index.ts`

## Required Implementation Details

- Prefer a small shared helper over duplicating binary path logic.
- The default local binary path should resolve from this repo/package location, not from the target repo path passed to Codex with `--cd`.
- The runner must still execute Codex inside the requested target repo through `--cd`; only the binary source changes.
- Preserve current `codex exec` arguments, including:
  - `--json`
  - `--color never`
  - `--sandbox`
  - `--config approval_policy="..."`
  - `--output-last-message`
- Update error handling so `spawn ENOENT` becomes an actionable Auto Forge message.
- Update docs and memory to state that Codex CLI is installed by bootstrap/build and that `OPENAI_API_KEY` remains the required unattended auth input.

## Proof Map

- Dependency seam: `package-lock.json` includes `@openai/codex@0.125.0`; `npm ci` installs `node_modules/.bin/codex`.
- Runner seam: targeted runner tests pass with sanitized `PATH` and no global `codex`.
- Override seam: tests still prove explicit fake binary and approval config behavior.
- Docker seam: `npm run full-rebuild` shows Compose smoke no longer reports Codex as degraded due missing binary.
- Health seam: health check reports the managed binary version when no override is set.
- Docs seam: install docs no longer instruct customers to install Codex manually.

## Required Proof Commands

Run and report:

```bash
npm run verify
npm run full-rebuild
```

Also run this direct fresh-VPS proof:

```bash
PATH=/usr/bin:/bin npm run test -- --run tests/codex-runner.test.ts
PATH=/usr/bin:/bin npm run ops:health
```

The proof must show the repo-managed Codex binary is used without global `codex` on `PATH`.

If live credentials are available, run:

```bash
npm run live:smoke
```

If live credentials are unavailable, stop as `BLOCKED_EXTERNAL` only after `npm run verify`, `npm run full-rebuild`, and the sanitized-PATH Codex proof pass.

## Completion Report

Write a timestamped report under `reports/`, refresh `reports/LATEST.md`, refresh `reports/LATEST.json`, update `automation/state.json` and `automation/qa.json`, commit, push, and report:

- exact dependency/version added
- binary resolution order implemented
- files changed
- proof that no global Codex install is required
- proof Docker/Compose path has Codex available
- tests run
- implementation commit SHA
- stop report commit SHA
- push status

## QA Gate

QA cannot accept this revision until a fresh server with no global `codex` can run the required test/build path after product bootstrap/build.
