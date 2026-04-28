# Managed Codex CLI Options And Recommendation

Updated: `2026-04-28T21:39:54Z`

## Production-Grade Bar Source

The production-grade bar comes from repo conventions plus official OpenAI Codex CLI guidance and current npm package metadata.

Ship-ready means the deployable product installs and resolves the Codex CLI itself during bootstrap/build, while keeping Codex auth as an explicit secret reference or selected env value.

## Option A - Global Install In Bootstrap

Add `npm install -g @openai/codex` to `scripts/bootstrap.sh`.

Pros:

- Small code change.
- Matches the literal OpenAI quick-start command.

Cons:

- Depends on global mutable host state.
- Can require elevated permissions or a user-specific npm prefix.
- Does not naturally fix Docker image behavior unless duplicated in `Dockerfile`.
- Makes tests and health checks sensitive to whatever global version is present.

Verdict: rejected. This is still an operator-machine prerequisite disguised as bootstrap.

## Option B - Repo-Managed npm Dependency

Add `@openai/codex@0.125.0` to repo dependencies and resolve the local binary by default.

Required behavior:

- `npm ci` installs Codex as part of the product.
- Runtime uses `CODEX_CLI_COMMAND` only when explicitly set.
- Without override, runtime resolves repo-local `node_modules/.bin/codex`.
- Docker image gets Codex automatically because it already runs `npm ci`.
- Tests prove a sanitized `PATH` still works after bootstrap.

Pros:

- Matches the current npm-distributed OpenAI CLI while avoiding global state.
- Keeps bootstrap and Docker behavior aligned.
- Makes the installed Codex version reproducible through `package-lock.json`.
- Fits the current TypeScript/npm repo and existing `CodexCliRunner`.

Cons:

- The dependency can add install weight.
- Future Codex CLI version upgrades become explicit dependency updates.

Verdict: recommended. It is the smallest production-grade fix for the current product architecture.

## Option C - Vendor Or Download A Binary

Download or vendor a Codex binary during bootstrap/build.

Pros:

- Could avoid npm global installs.
- Could support a custom pinned artifact flow later.

Cons:

- More operational maintenance.
- More platform logic.
- Less aligned with the current npm project and official npm package.

Verdict: too heavy for this revision.

## Recommendation

Implement Option B now.

Use `@openai/codex@0.125.0` as a normal product dependency, introduce a shared local binary resolver, and update all Codex execution and health paths to use that resolver. Keep `CODEX_CLI_COMMAND` as an escape hatch, but stop documenting global Codex as a prerequisite.

Future growth that could justify a different path:

- a stable Codex SDK replaces CLI execution
- an official container image or server runtime becomes preferable
- multi-tenant SaaS isolation requires per-run sandbox images with pinned Codex versions

## Confirmed Facts

- Current code defaults to spawning `codex` directly.
- `scripts/bootstrap.sh` runs `npm ci` but the repo has no Codex dependency today.
- Docker images currently install repo dependencies only.
- `@openai/codex@0.125.0` publishes a `codex` binary through npm.

## Inferences

- A repo-managed dependency is the best fit because the product already controls Node dependencies through `npm ci` and Docker build layers.
- The future browser/chat wizard should call server-side install/health endpoints, so the server must be self-contained before the UI is built.
