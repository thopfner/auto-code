# Phase 1 QA Checkpoint - Codex Runtime And Artifact Persistence

- stop_status: `QA_CHECKPOINT_READY`
- branch: `main`
- implementation_commit_sha: `00ec1c7ae1375d23ed838cf0aa35ba2d27d7657d`
- stop_report_commit_sha: `28abdb9a2866ee8e5e43670680de3491d1becc2c`
- push_status: `pushed to github-auto-forge:thopfner/auto-code.git main`
- updated_at: `2026-04-29T21:16:50Z`

## Summary

Implemented the Phase 1 runtime contract for deployed Codex execution:

- Docker Compose now sets active `CODEX_HOME=/data/codex-home` for API, worker, and smoke service runtime.
- The host OAuth cache is mounted separately and read-only at `/codex-auth-source`.
- Compose sets runner prompt and artifact roots to `/data/prompts` and `/data/artifacts`.
- The VPS installer writes `AUTO_FORGE_CODEX_AUTH_SOURCE_DIR`, prepares persisted data directories, runs host live smoke with writable `CODEX_HOME`, and preserves backward compatibility for older `AUTO_FORGE_CODEX_HOME_DIR` overrides as the OAuth source path.
- `CodexCliRunner` prepares OAuth-backed runs by copying only `auth.json` and `config.toml` into the writable active home when missing, with restrictive modes, while preserving existing runtime files.
- Runner failures now return redacted actionable blocker summaries for read-only homes, permission errors, missing auth, and missing Codex CLI.
- Deployment docs and live-smoke requirements now describe the separated auth-source/runtime-home contract.

## Files Changed

- `docker-compose.yml`
- `scripts/install-vps.sh`
- `packages/adapters/src/codex-runner.ts`
- `tools/live-external-smoke.ts`
- `tests/codex-runner.test.ts`
- `tests/vps-installer.test.ts`
- `docs/deployment/README.md`
- `docs/deployment/vps.md`

## Verification

Passed:

- `npm run test -- --run tests/codex-runner.test.ts tests/vps-installer.test.ts tests/telegram-workflow-api.test.ts`
- `npm run test -- --run tests/vps-installer.test.ts tests/codex-runner.test.ts`
- `npm run verify`
- `docker compose build`
- `AUTO_FORGE_HOST_DATA_DIR=/tmp/auto-forge-compose-proof AUTO_FORGE_API_PORT=3301 AUTO_FORGE_WEB_PORT=5574 docker compose up -d postgres api worker web`
- `AUTO_FORGE_HOST_DATA_DIR=/tmp/auto-forge-compose-proof AUTO_FORGE_API_PORT=3301 AUTO_FORGE_WEB_PORT=5574 docker compose logs --tail=100 api`
- `AUTO_FORGE_HOST_DATA_DIR=/tmp/auto-forge-compose-proof AUTO_FORGE_API_PORT=3301 AUTO_FORGE_WEB_PORT=5574 docker compose -f docker-compose.yml -f docker-compose.smoke.yml run --rm smoke`
- `AUTO_FORGE_HOST_DATA_DIR=/tmp/auto-forge-compose-proof AUTO_FORGE_API_PORT=3301 AUTO_FORGE_WEB_PORT=5574 docker compose down --remove-orphans`

Proof details:

- API service was healthy and `/live` returned 200 in Compose logs.
- API container reported `CODEX_HOME=/data/codex-home`, `authSource=/codex-auth-source`, `promptRoot=/data/prompts`, `artifactRoot=/data/artifacts`, `codexHomeWritable=true`, and `authSourceIsActiveHome=false`.
- Worker container reported `CODEX_HOME=/data/codex-home`, `authSource=/codex-auth-source`, `codexHomeWritable=true`, and `authSourceIsActiveHome=false`.
- Container-visible persisted proof files existed at `/data/codex-home/api-writable-proof`, `/data/codex-home/worker-writable-proof`, `/data/prompts/api-prompt-proof`, and `/data/artifacts/api-artifact-proof` with mode `0600`.
- Compose config after scope correction confirmed the smoke service still inherits `CODEX_HOME=/data/codex-home`, `/data/prompts`, `/data/artifacts`, and `/codex-auth-source`.

Cleanup:

- The Compose stack was stopped with `docker compose down --remove-orphans`.
- Temporary proof data under `/tmp/auto-forge-compose-proof` was removed after validation.

## Known Limits

- No live Telegram/OpenClaw/OpenAI/GitHub deploy-key proof was run in this shell because the authorized Phase 1 validation focused on local deterministic runtime and Compose proof.
- The separate Postgres workflow-store durability gap remains out of scope for this phase.
- External QA must review this checkpoint before authorizing Phase 2.

## Durable Memory Candidates

- Deployed containers use `/data/codex-home` as writable active `CODEX_HOME`; the protected OAuth source cache is mounted read-only at `/codex-auth-source`.
- Compose runner prompts and artifacts persist under `/data/prompts` and `/data/artifacts`.
- `AUTO_FORGE_CODEX_AUTH_SOURCE_DIR` is the installer/Compose host-side OAuth source override; legacy `AUTO_FORGE_CODEX_HOME_DIR` remains accepted as a source-path compatibility alias.
- Codex runner blocker summaries now classify read-only runtime homes, permission failures, missing auth, and missing CLI without exposing raw secret values in Telegram-facing text.
