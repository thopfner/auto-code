# Phase 2 - Observability, Health, And Installer Semantics

Execution mode: `QA_CHECKPOINT`
Validation level: `SERVICE_RESTART`
Authorization status: cleared by QA on `2026-04-29T21:41:45Z`

## Goal

Make runner failures, health checks, test timing, and installer live-smoke behavior truthful and operator-actionable after the runtime layout is fixed.

## Risky Seams

- Redacted operational error reporting to Telegram.
- Host/container path resolution.
- Installer exit semantics and operator trust.
- Intermittent subprocess test timing.

## Owned Paths

Likely owned files:

- `packages/adapters/src/codex-runner.ts`
- `packages/core/src/workflow-engine.ts`
- `packages/ops/src/health.ts`
- `packages/ops/src/paths.ts`
- `apps/cli/src/index.ts`
- `packages/ops/src/vps-setup.ts`
- `scripts/install-vps.sh`
- `tests/codex-runner.test.ts`
- `tests/ops.test.ts`
- `tests/vps-setup-wizard.test.ts`
- `tests/vps-installer.test.ts`
- `docs/deployment/README.md`
- `docs/deployment/vps.md`
- this brief directory

Exact files may narrow during implementation, but do not broaden into unrelated product surfaces.

## Required Implementation Contract

- `CodexCliRunner` must include a short safe failure summary in `blockerReason` when `codex exec` exits non-zero.
- The summary must be redacted for API keys, bearer tokens, private key blocks, obvious auth JSON tokens, and long opaque secret-like values.
- Common cases should be recognizable enough for Telegram, such as:
  - read-only `CODEX_HOME`
  - missing Codex CLI
  - missing/invalid auth
  - permission denied
  - output-last-message or artifact write failure
- Keep full raw output in persisted artifacts for debugging.
- Avoid duplicating immediate deterministic infra failures when retrying would only spam Telegram. Either classify such failures as blocked or suppress repeated "Starting scope run" messages for same-root-cause retries.
- Host CLI health must resolve the host-visible setup path when the env file points containers at `/data/setup.json`.
- Container services must keep using `/data/setup.json`.
- Test subprocesses in `tests/vps-setup-wizard.test.ts` must have deterministic timeouts that exceed the subprocess timeout or be refactored to avoid slow subprocess startup.
- Installer live-smoke semantics must be explicit:
  - either make production/live mode hard-fail on live-smoke failure; or
  - keep first-run onboarding non-fatal but print and document unmistakable `BLOCKED_EXTERNAL`, with an opt-in hard gate for production automation.

## Edge-State Matrix

- Runner fails before writing JSONL: blocker still includes startup error.
- Runner writes stderr/stdout with a known infrastructure failure: blocker includes classified redacted summary.
- Runner writes large JSONL: blocker includes bounded tail only.
- Runner output includes secret-looking content: Telegram-safe summary redacts it.
- Host CLI health runs from repo root with container env paths: uses host setup path or explains missing host mapping.
- Container API health runs inside Compose: still uses `/data/setup.json`.
- Live smoke missing external credentials: installer output cannot be mistaken for full production success.
- Live smoke fails after credentials are present: hard-gate mode exits non-zero.

## Required Tests And Proof

Run at minimum:

```bash
npm run test -- --run tests/codex-runner.test.ts tests/ops.test.ts tests/vps-setup-wizard.test.ts tests/vps-installer.test.ts
npm run verify
```

If service behavior changed, also run:

```bash
AUTO_FORGE_API_PORT=<free-port> AUTO_FORGE_WEB_PORT=<free-port> docker compose up -d --build api worker web
docker compose logs --tail=100 api
docker compose logs --tail=100 worker
```

Topology requirement:

- In `/var/www/html/auto.thapi.cc`, the Compose commands above are disposable source/dev validation only.
- Use alternate ports when needed.
- Clean up validation services before stopping.
- Do not leave this dev checkout running as the product.
- Do not perform deployed-target service restarts from this phase unless the operator explicitly authorizes a target install path and confirms the pushed commit has been pulled there.

## Gate

Stop at `QA_CHECKPOINT`. External QA must review before Phase 3 starts.
