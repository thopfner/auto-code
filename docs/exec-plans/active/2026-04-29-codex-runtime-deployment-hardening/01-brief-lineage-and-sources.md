# Brief Lineage And Sources

## Lineage

Version: `v1`
Created: `2026-04-29T21:02:40Z`

This brief follows a read-only review of the deployed VPS repo at `/opt/auto-forge-controller` on `hopfner.dev`, branch `main`, HEAD `fb04200e298ed54daaf305ae45ae2a4fe9cf02b0`.

The user-facing failure was:

```text
Blocked: codex exec exited with 1
```

Runner artifacts inside the API container showed:

```text
WARNING: proceeding, even though we could not update PATH: Read-only file system (os error 30)
ERROR codex_core::session: Failed to create session: Read-only file system (os error 30)
Error: thread/start: thread/start failed: error creating thread: Fatal error: Failed to initialize session: Read-only file system (os error 30)
```

Local planning confirmed the repo was on `main` at `fb04200e298ed54daaf305ae45ae2a4fe9cf02b0` with only pre-existing untracked `tools/forge/__pycache__/`.

## Repo Evidence

- `docker-compose.yml` sets `CODEX_HOME: /root/.codex` and mounts `${AUTO_FORGE_CODEX_HOME_DIR:-/root/.codex}:/root/.codex:ro` for API, worker, and smoke.
- `scripts/install-vps.sh` writes `AUTO_FORGE_CODEX_HOME_DIR=$CODEX_HOME_DIR` into the Compose project env and runs OAuth login with `CODEX_HOME="$CODEX_HOME_DIR"`.
- `packages/adapters/src/codex-runner.ts` returns `blockerReason: codex exec exited with <code>` for all non-zero exits.
- `packages/core/src/workflow-engine.ts` defaults artifact root to `.auto-forge/artifacts`.
- `apps/api/src/server.ts` can pass `AUTO_FORGE_ARTIFACT_ROOT` and `AUTO_FORGE_PROMPT_ROOT`, but Compose does not set them.
- `scripts/install-vps.sh` currently ignores live smoke failure with `run_live_smoke_gate "$repo_dir" || true`.
- `apps/api/src/server.ts` still uses `new MemoryWorkflowStore()`.
- `apps/worker/src/worker.ts` writes heartbeat and idles.

## Primary Sources Checked

- OpenAI Codex authentication docs: `https://developers.openai.com/codex/auth`
  - Codex caches login locally.
  - File credential storage uses `auth.json` under `CODEX_HOME`.
  - `auth.json` contains access tokens and must not be committed, pasted into tickets, or shared in chat.
  - Device code auth is a supported headless login path.
- OpenAI Codex CLI reference: `https://developers.openai.com/codex/cli/reference`
  - `codex exec` is the scripted/CI-style command.
  - Relevant options include `--json`, `--output-last-message`, `--cd`, `--sandbox`, `--ephemeral`, and `--config`.
- OpenAI Codex config reference: `https://developers.openai.com/codex/config-reference`
  - Codex writes logs under `log_dir`, defaulting to `$CODEX_HOME/log`.
  - History persistence can write `history.jsonl`.
- Docker bind mount docs: `https://docs.docker.com/engine/storage/bind-mounts/`
  - `readonly` / `ro` makes the mount read-only.
- Docker volume docs: `https://docs.docker.com/engine/storage/volumes/`
  - Persisted container-generated data belongs in mounted storage, not the container writable layer.

## Planning Decision

The agreed plan is Option B: production deployment repair now, followed by a separate Postgres durability/orchestration pack later.

Option C, bundling Postgres workflow state and real worker queue into this repair, was rejected for this batch because it mixes a live deployment blocker with schema, queue, recovery, and cross-service ownership risk.

## Subsequent Postgres Pack Note

A later pack is required after this repair proves the live runner path. Working title:

```text
2026-04-30-postgres-workflow-queue-durability
```

That pack should address:

- replacing `MemoryWorkflowStore` in production
- durable tasks, approvals, run attempts, artifacts, locks, and events in Postgres
- worker-owned durable queue consumption
- retry, recovery, cancellation, and idempotency semantics
- API/worker split of responsibilities
- migrations and migration tests
- runtime recovery proof across service restart

This note is part of the durable plan lineage and should be promoted into repo memory at final shipgate if still accurate.
