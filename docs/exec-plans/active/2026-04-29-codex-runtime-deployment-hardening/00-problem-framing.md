# Problem Framing

## Objective

Make the deployed Auto Forge Controller stack reliably execute Telegram-triggered Codex runs inside Docker and make failures diagnosable without leaking secrets.

## Desired Outcome

The operator can send:

```text
/scope @auto-forge-controller add a docs only note explaining this is a vps smoke test. stop after planning and QA
```

and the stack no longer blocks immediately with `codex exec exited with 1` due to a read-only `CODEX_HOME`.

## In Scope

- Docker Compose Codex runtime layout for API, worker, and smoke containers.
- VPS installer Codex auth environment and Compose project env generation.
- Writable active `CODEX_HOME` under the persisted data mount.
- Read-only auth-source mount for trusted OAuth cache input.
- API-key mode with writable Codex runtime state.
- Persisted prompt and artifact roots.
- Redacted runner failure summaries surfaced through `blockerReason`.
- Health path handling for host vs container runtime paths.
- Installer live-smoke semantics and documentation.
- Targeted tests and VPS validation steps.

## Out Of Scope

- Postgres-backed workflow store and durable queue implementation.
- Worker-driven orchestration replacing API-direct workflow execution.
- Changing Telegram webhook ownership.
- Changing OpenClaw gateway ownership.
- Replacing Codex CLI with the Codex SDK.
- Adding duplicate repo checkouts or `git worktree` directories.
- Storing raw secrets in setup JSON, reports, logs, Telegram, or Git.

## Constraints And Invariants

- Current repo path is `/var/www/html/auto.thapi.cc` on `main`.
- Reviewed deployment path was `/opt/auto-forge-controller`, also on `main` at `fb04200e298ed54daaf305ae45ae2a4fe9cf02b0`.
- Compose currently mounts the host Codex home read-only as active `/root/.codex`; this is incompatible with Codex runtime session/log/cache writes.
- `CODEX_AUTH_REF=secret:codex-oauth-local-cache` must continue to mean a protected local OAuth cache reference, not a raw secret copied into app state.
- `CODEX_AUTH_REF=env:OPENAI_API_KEY` must continue to support API-key auth.
- Artifacts must persist through container rebuild/recreate.
- Telegram messages may include redacted summaries but must not include auth tokens, API keys, or private key material.

## Relevant Code Surfaces

- `docker-compose.yml`
- `scripts/install-vps.sh`
- `packages/adapters/src/codex-runner.ts`
- `packages/core/src/workflow-engine.ts`
- `packages/core/src/prompt-builder.ts`
- `apps/api/src/server.ts`
- `packages/ops/src/health.ts`
- `packages/ops/src/paths.ts`
- `apps/cli/src/index.ts`
- `packages/ops/src/vps-setup.ts`
- `docs/deployment/README.md`
- `docs/deployment/vps.md`
- `docs/agent-memory/CURRENT_STATE.md`
- `docs/agent-memory/ARCHITECTURE.md`
- `docs/agent-memory/TESTING.md`
- Tests likely include `tests/vps-installer.test.ts`, `tests/codex-runner.test.ts`, `tests/ops.test.ts`, `tests/vps-setup-wizard.test.ts`, `tests/telegram-workflow-api.test.ts`, and `tools/live-external-smoke.ts`.

## Unknowns And Risks

- The exact Codex CLI file set needed from the OAuth source may include `auth.json`, `config.toml`, and related auth/config files. The implementation must avoid broad unsafe copying while preserving a working login.
- Codex may refresh ChatGPT tokens during active use. The writable runtime home must support that without writing back into a read-only source mount.
- Host CLI health may need an explicit host path override rather than interpreting container paths literally.
- Installer live-smoke behavior may need a product decision: hard fail by default for production deploys, or non-fatal with unmistakable `BLOCKED_EXTERNAL` semantics.
- The current in-memory workflow store and idle worker remain production gaps after this repair and require a separate Postgres durability pack.
