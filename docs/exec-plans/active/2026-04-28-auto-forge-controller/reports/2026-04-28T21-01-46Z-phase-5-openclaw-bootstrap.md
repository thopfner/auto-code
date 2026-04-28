# Phase 5 OpenClaw Bootstrap Revision Stop

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-28T21:01:46Z`
Stop status: `BLOCKED_EXTERNAL`

## Phase Addressed

- `59-phase-5-revision-openclaw-bootstrap.md`
- Execution mode: `FINAL_SHIPGATE_REVISION`
- Validation level: `FULL_REBUILD`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Implementation commit SHA: `2745d1f4b1ac45878d3f1719517d0427f109ed61`
- Stop report commit SHA: `de873132f6437204c57a6737f5dedb500aad5b6b`
- Push status: pushed. Stop report commit `de873132f6437204c57a6737f5dedb500aad5b6b` is contained in `origin/main`.

## OpenClaw Setup Modes Implemented

- `detect-existing`: default setup mode. Uses `openclaw gateway status --json --require-rpc` and may use an explicit gateway URL as a deterministic non-interactive reference when CLI discovery is unavailable.
- `install-or-onboard`: reports exact OpenClaw install/onboarding next steps when the CLI is missing or the gateway is not running.
- `configure-later`: writes setup as incomplete/deferred and makes live smoke block with an actionable OpenClaw onboarding message.
- `advanced-webhook`: optional mode requiring an explicit `env:` or `secret:` auth reference for intentional webhook-token installs.

## Files Changed

- `.env.example`
- `apps/api/src/server.ts`
- `apps/cli/src/index.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/onboarding.ts`
- `docs/deployment/README.md`
- `docs/deployment/vps.md`
- `packages/adapters/src/openclaw.ts`
- `packages/config/src/runtime-config.ts`
- `packages/core/src/setup.ts`
- `packages/ops/src/backup.ts`
- `packages/ops/src/index.ts`
- `packages/ops/src/openclaw-setup.ts`
- `packages/ops/src/vps-setup.ts`
- `scripts/bootstrap.sh`
- `tests/config.test.ts`
- `tests/onboarding-flow.test.ts`
- `tests/vps-setup-wizard.test.ts`
- `tools/live-external-smoke.ts`

## Implementation Summary

- Replaced the normal fresh-VPS OpenClaw token prompt with OpenClaw setup mode selection and gateway discovery/bootstrap handling.
- Added a reusable OpenClaw gateway discovery helper around `openclaw gateway status --json --require-rpc`.
- Extended setup JSON with OpenClaw mode, optional auth reference, and discovery metadata while tolerating legacy `openClaw.tokenRef`.
- Updated CLI, web onboarding, API setup validation, runtime config, health/live smoke, backup restore validation, env example, bootstrap copy, and deployment docs.
- Kept advanced webhook auth references optional and explicit; default setup no longer writes or requires `OPENCLAW_TOKEN`.

## Required Proof

Deterministic default setup proof command:

```bash
tmpdir=$(mktemp -d)
env -u OPENCLAW_TOKEN -u OPENCLAW_TOKEN_REF -u OPENCLAW_AUTH_REF npm run setup:vps -- \
  --non-interactive \
  --public-base-url https://forge.example.com \
  --api-port 3000 \
  --web-port 5173 \
  --openclaw-base-url http://127.0.0.1:18789 \
  --telegram-bot-token-ref env:TELEGRAM_BOT_TOKEN \
  --telegram-chat-id -100123 \
  --codex-auth-ref env:OPENAI_API_KEY \
  --runtime-env-file "$tmpdir/.env" \
  --setup-path "$tmpdir/setup.json"
```

Result: passed.

- Setup JSON wrote `openClaw.mode: "detect-existing"`.
- Setup JSON contained no raw secrets.
- Generated env/setup output did not contain `OPENCLAW_TOKEN`.
- Setup JSON stored OpenClaw gateway URL, hook path, and discovery metadata as references/non-secret derived details.

Missing `OPENCLAW_TOKEN` live-smoke proof:

```bash
env -u OPENCLAW_TOKEN -u OPENCLAW_TOKEN_REF -u OPENCLAW_AUTH_REF \
  OPENCLAW_BASE_URL=http://127.0.0.1:18789 \
  OPENCLAW_SETUP_MODE=detect-existing \
  npm run live:smoke
```

Result: exited `BLOCKED_EXTERNAL` for only:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_TEST_CHAT_ID`
- `OPENAI_API_KEY`

`OPENCLAW_TOKEN` was not listed as a missing default requirement.

## Verification Run

```bash
npm run verify
```

Result: passed. ESLint, TypeScript, schema check, and Vitest passed: 14 files, 52 tests.

```bash
npm run full-rebuild
```

Result: passed. Completed fresh bootstrap, verify, install-check, runtime health, references-only backup/restore, recovery dry run, task/service log discovery, Docker Compose build/up/smoke, and cleanup.

`npm run live:smoke` remains externally blocked because this shell does not have live Telegram/OpenAI credentials:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_TEST_CHAT_ID`
- `OPENAI_API_KEY`

## Blockers Or Residual Risks

- No implementation blocker remains for the OpenClaw bootstrap revision.
- Final go-live proof still requires real staged or live Telegram, OpenClaw gateway, and OpenAI credentials. OpenClaw default gateway mode no longer requires a user-entered `OPENCLAW_TOKEN`.
- Exact OpenClaw CLI status JSON can vary by installed OpenClaw version; the parser accepts common URL/auth field names and fails closed with operator next steps when no gateway URL is reported.

## Durable Memory Candidates

- Fresh VPS setup defaults to `OPENCLAW_SETUP_MODE=detect-existing` and uses OpenClaw gateway discovery/bootstrap instead of asking for `OPENCLAW_TOKEN`.
- `OPENCLAW_AUTH_REF` is advanced-only webhook auth; default live smoke requires `OPENCLAW_BASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_TEST_CHAT_ID`, and `OPENAI_API_KEY`.
- Setup JSON supports `openClaw.mode`, optional `openClaw.authRef`, discovery metadata, and legacy `openClaw.tokenRef` compatibility.

## QA Status

`BLOCKED_EXTERNAL`
