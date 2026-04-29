# Phase 2 QA Checkpoint - Observability, Health, And Installer Semantics

- stop_status: `QA_CHECKPOINT_READY`
- branch: `main`
- implementation_commit_sha: `62eeb17c6108c6380cb38b1cf737832556dc9768`
- stop_report_commit_sha: `pending-report-commit`
- push_status: `pending`
- updated_at: `2026-04-29T21:36:55Z`

## Summary

Implemented the Phase 2 observability and installer semantics contract:

- `CodexCliRunner` now returns short Telegram-safe blocker summaries for deterministic infrastructure failures and marks those outcomes `blocked` so workflow retries do not spam duplicate start/block messages.
- Failure summaries now redact OpenAI keys, Telegram bot tokens, bearer tokens, JWTs, private key blocks, common auth JSON fields, and long opaque secret-like values while preserving raw process output in the persisted runner log.
- Runner summaries classify read-only `CODEX_HOME`, permission denied, missing auth, missing Codex CLI, and output/artifact write failures with operator-actionable next steps.
- Host-side ops path resolution maps container `/data/*` paths back to the host Compose data directory for CLI health while Compose services continue using `/data/*` directly.
- The VPS installer keeps first-run live-smoke `BLOCKED_EXTERNAL` non-fatal, but now documents and implements `AUTO_FORGE_LIVE_SMOKE_HARD_GATE=1` for production automation that must fail closed.
- The guided setup CLI no longer claims OAuth-backed live smoke requires `OPENAI_API_KEY`; it delegates live-smoke requirements to the shared live gate.
- Subprocess-backed VPS setup tests now have explicit test timeouts longer than their child-process timeout.

## Files Changed

- `packages/adapters/src/codex-runner.ts`
- `packages/core/src/workflow-engine.ts` test coverage via `tests/workflow-engine.test.ts`
- `packages/ops/src/paths.ts`
- `apps/cli/src/index.ts`
- `scripts/install-vps.sh`
- `tests/codex-runner.test.ts`
- `tests/ops.test.ts`
- `tests/vps-setup-wizard.test.ts`
- `tests/vps-installer.test.ts`
- `tests/workflow-engine.test.ts`
- `docs/deployment/README.md`
- `docs/deployment/vps.md`

## Verification

Passed:

```bash
npm run test -- --run tests/codex-runner.test.ts tests/ops.test.ts tests/vps-setup-wizard.test.ts tests/vps-installer.test.ts
npm run verify
AUTO_FORGE_API_PORT=3121 AUTO_FORGE_WEB_PORT=5181 docker compose up -d --build api worker web
docker compose logs --tail=100 api
docker compose logs --tail=100 worker
docker compose ps
docker compose down --remove-orphans
```

Proof details:

- Targeted Phase 2 test suite passed with 4 files and 45 tests.
- Full verification passed lint, typecheck, schema check for 9 tables, and 17 test files with 111 tests.
- Compose rebuild/start succeeded for API, worker, web, and Postgres on alternate ports `3121` and `5181`.
- API service became healthy and `/live` returned HTTP 200 in container logs.
- Worker service started and reported `auto-forge-worker ready` with runner `codex-cli`.

Cleanup:

- The validation Compose stack was stopped with `docker compose down --remove-orphans`.
- Pre-existing untracked `tools/forge/__pycache__/` was not touched.

## Known Limits

- Live Telegram/OpenClaw/OpenAI proof was not run in this Phase 2 window; Phase 3 remains the authorized VPS Telegram proof window after external QA clearance.
- No Telegram webhook ownership, OpenClaw gateway ownership, repo registry/SSH behavior, or Postgres workflow durability architecture was changed.
- External QA must review this checkpoint before Phase 3 starts.

## Durable Memory Candidates

- Codex deterministic infrastructure failures are represented as blocked runner results with redacted operator-actionable summaries, avoiding repeated retries for the same missing CLI/auth/path/write root cause.
- Host CLI health maps container `/data/*` runtime paths to `AUTO_FORGE_HOST_DATA_DIR` or `.auto-forge/compose-data`; containers continue to use `/data/*` directly.
- `AUTO_FORGE_LIVE_SMOKE_HARD_GATE=1` makes installer live-smoke `BLOCKED_EXTERNAL` fail closed for production automation, while first-run onboarding remains non-fatal by default.
