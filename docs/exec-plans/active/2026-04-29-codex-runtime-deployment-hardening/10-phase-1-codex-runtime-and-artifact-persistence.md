# Phase 1 - Codex Runtime And Artifact Persistence

Execution mode: `QA_CHECKPOINT`
Validation level: `FULL_REBUILD`
Authorization status: cleared by QA on `2026-04-29T21:24:15Z`

## Goal

Fix the Docker/installer runtime contract so `codex exec` has a writable active `CODEX_HOME`, protected OAuth source material remains separate, and prompts/artifacts persist under `/data`.

## Risky Seams

- Codex auth and credential-cache handling.
- Container mount permissions and writable runtime state.
- Deployment path compatibility between host installer, Compose, API, worker, and smoke service.
- Artifact/prompt retention across container rebuilds.

## Owned Paths

- `docker-compose.yml`
- `scripts/install-vps.sh`
- `packages/adapters/src/codex-runner.ts`
- `packages/core/src/workflow-engine.ts`
- `packages/core/src/prompt-builder.ts`
- `apps/api/src/server.ts`
- `tools/live-external-smoke.ts`
- `tests/codex-runner.test.ts`
- `tests/vps-installer.test.ts`
- `tests/telegram-workflow-api.test.ts`
- `docs/deployment/README.md`
- `docs/deployment/vps.md`
- this brief directory

Do not edit unrelated UI, repo registry, SSH key manager, or durable-memory files in this phase unless a direct runtime-contract test requires a narrow doc correction.

## Required Implementation Contract

Implement the runtime layout:

- `CODEX_HOME=/data/codex-home` or an equivalent persisted writable path under `/data`.
- OAuth source cache mounted read-only at a separate path such as `/codex-auth-source`.
- API, worker, and smoke services must use the same active writable Codex home contract.
- Active Codex home and relevant subdirectories must be created with restrictive permissions where controlled by installer/startup code.
- Do not mount the host OAuth cache read-write as active `CODEX_HOME`.
- Do not log raw auth file content.
- Do not put raw auth values into setup JSON, Telegram output, reports, or normal logs.
- API-key auth still works and still gets a writable active Codex home.
- Compose sets `AUTO_FORGE_ARTIFACT_ROOT=/data/artifacts`.
- Compose sets `AUTO_FORGE_PROMPT_ROOT=/data/prompts`.
- Runner prompts and artifacts are written under those roots when services run in Compose.

The implementation may use one of these patterns:

- copy only the required non-secret-safe-plus-auth files from `/codex-auth-source` to `/data/codex-home` at container startup or before runner execution, while preserving secret redaction and restrictive permissions; or
- configure Codex to use a writable home while resolving credentials through a supported file/keyring/config mechanism that does not require mutating the read-only source.

If neither pattern can be proven with the installed Codex CLI, stop with a blocker report and include the minimal reproduction output.

## Edge-State Matrix

- OAuth source exists and active `/data/codex-home` is empty: first run initializes from source and succeeds or reports actionable auth blocker.
- OAuth source exists and active `/data/codex-home` already exists: startup/run preserves existing writable state and does not overwrite newer runtime files blindly.
- OAuth source missing in OAuth mode: fail closed with a clear redacted blocker.
- API-key mode with no OAuth source: no OAuth-source copy required; `codex exec` still has writable home.
- `/data` not writable: fail with clear deployment-path blocker.
- Container recreated: prompts/artifacts and writable Codex runtime state remain available through host-mounted data.

## Required Tests And Proof

Run at minimum:

```bash
npm run test -- --run tests/codex-runner.test.ts tests/vps-installer.test.ts tests/telegram-workflow-api.test.ts
npm run verify
docker compose build
AUTO_FORGE_API_PORT=<free-port> AUTO_FORGE_WEB_PORT=<free-port> docker compose up -d postgres api worker web
docker compose logs --tail=100 api
```

Also prove with a local or container smoke that:

- `CODEX_HOME` inside API/worker is writable
- OAuth source mount, when configured, is not the active writable home
- `/data/artifacts` and `/data/prompts` are used by workflow runs or smoke fixtures

Use alternate ports if defaults are busy. Clean up any Compose stack started for validation unless the operator asks to keep it running.

## Why FULL_REBUILD

This phase changes Docker Compose mounts, runtime env, installer output, and image-baked service behavior. A stack rebuild/recreate is the cheapest truthful proof.

## Gate

Stop at `QA_CHECKPOINT`. External QA must review before Phase 2 starts.
