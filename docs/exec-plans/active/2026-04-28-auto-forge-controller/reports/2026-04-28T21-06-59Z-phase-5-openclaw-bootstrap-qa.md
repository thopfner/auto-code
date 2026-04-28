# Phase 5 OpenClaw Bootstrap QA

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-28T21:06:59Z`
QA status: `REVISION_PACK_REQUIRED`

## Finding

### 1. Non-interactive default setup does not fail closed when OpenClaw discovery fails

Severity: blocking
Type: `execution_miss`

The revision brief explicitly requires fail-closed behavior when Auto Forge cannot prove OpenClaw gateway reachability and the operator did not choose `configure-later`:

- `59-phase-5-revision-openclaw-bootstrap.md`, lines 63-67

The implementation does not satisfy that. With no `openclaw` CLI on `PATH`, no explicit OpenClaw URL, and default `detect-existing` mode, the non-interactive setup command exits successfully and writes:

```json
"openClaw": {
  "baseUrl": "http://localhost:18789",
  "mode": "detect-existing",
  "discovery": {
    "source": "openclaw-cli",
    "status": "missing-cli",
    "message": "OpenClaw CLI is not installed or not on PATH."
  }
}
```

That is a false setup success: the operator did not choose `configure-later`, and no gateway was proven.

Relevant code:

- `apps/cli/src/index.ts` falls back to `http://localhost:18789` at line 216 even when discovery failed.
- `packages/ops/src/openclaw-setup.ts` returns failed discovery details, but the non-interactive setup path still writes a successful setup artifact.

## Evidence

Command:

```bash
tmpdir=$(mktemp -d /tmp/auto-forge-qa-default-openclaw-XXXXXX)
PATH=/usr/bin:/bin npm run setup:vps -- \
  --non-interactive \
  --public-base-url https://forge.example.com \
  --api-port 3000 \
  --web-port 5173 \
  --telegram-bot-token-ref env:TELEGRAM_BOT_TOKEN \
  --telegram-chat-id -100123 \
  --codex-auth-ref env:OPENAI_API_KEY \
  --runtime-env-file "$tmpdir/.env" \
  --setup-path "$tmpdir/setup.json"
```

Result: exited `0` and wrote setup JSON with `mode: "detect-existing"` plus `discovery.status: "missing-cli"`.

This violates the brief because default detection should either prove a gateway, require an explicit URL/auth path that is truthfully marked, or stop with OpenClaw onboarding instructions. It should not write successful detect-existing setup when detection failed.

## Validation Performed

```bash
npm run verify
```

Initial result: failed before tests due to a root-owned stale `node_modules/.vite-temp` cache directory.

Repair: removed ignored cache directory `node_modules/.vite-temp`.

Second result: passed. ESLint, TypeScript, schema check, and Vitest passed: 14 files, 52 tests.

```bash
OPENCLAW_BASE_URL=http://127.0.0.1:18789 OPENCLAW_SETUP_MODE=detect-existing env -u OPENCLAW_TOKEN -u OPENCLAW_AUTH_REF -u OPENCLAW_TOKEN_REF npm run live:smoke
```

Result: `BLOCKED_EXTERNAL` only for `TELEGRAM_BOT_TOKEN`, `TELEGRAM_TEST_CHAT_ID`, and `OPENAI_API_KEY`; missing `OPENCLAW_TOKEN` is no longer the default blocker.

`npm run full-rebuild` was not rerun by QA because the direct setup proof exposed a blocking acceptance failure.

## Accepted Coverage

- Normal setup no longer asks for an OpenClaw token.
- Default live smoke no longer hard-requires `OPENCLAW_TOKEN`.
- Advanced webhook auth is separated behind an explicit mode.
- References-only setup behavior remains covered by tests.

## Revision Required

Implement `61-phase-5-revision-openclaw-fail-closed.md`.

## QA Metadata

- Reviewed implementation commit SHA: `2745d1f4b1ac45878d3f1719517d0427f109ed61`
- Reviewed worker stop report commit SHA: `de873132f6437204c57a6737f5dedb500aad5b6b`
- QA report commit SHA: `PENDING_METADATA_STAMP`
- Branch: `main`
- Repo path: `/var/www/html/auto.thapi.cc`

## QA Status

`REVISION_PACK_REQUIRED`
