# Phase 5 OpenClaw Fail-Closed Revision Stop

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-28T21:13:25Z`
Stop status: `BLOCKED_EXTERNAL`

## Phase Addressed

- `61-phase-5-revision-openclaw-fail-closed.md`
- Execution mode: `FINAL_SHIPGATE_REVISION`
- Validation level: `FULL_REBUILD`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Implementation commit SHA: `f8a61bc5e6923c15f87b963f4df9ec9bcce0fe83`
- Stop report commit SHA: `PENDING_STOP_REPORT_COMMIT`
- Push status: pending at report creation; must be pushed after report commit.

## Files Changed

- `apps/cli/src/index.ts`
- `tests/vps-setup-wizard.test.ts`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/2026-04-28T21-13-25Z-phase-5-openclaw-fail-closed.md`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/LATEST.md`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/LATEST.json`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/automation/state.json`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/automation/qa.json`

## Fail-Closed Behavior Implemented

- Non-interactive `detect-existing` now stops before any env/setup writes when OpenClaw discovery fails and the operator did not explicitly choose `configure-later`.
- The failed default path exits non-zero with the OpenClaw discovery message and next onboarding step.
- `configure-later` remains an explicit incomplete setup path and writes setup with `openClaw.mode: "configure-later"` plus `discovery.status: "configure-later"`.
- Explicit `--openclaw-base-url` fallback remains allowed, but the setup record truthfully stores discovery as manual rather than CLI-detected.

## Required Negative Proof

Command:

```bash
tmpdir=$(mktemp -d /tmp/auto-forge-qa-default-openclaw-XXXXXX)
if PATH=/usr/bin:/bin npm run setup:vps -- \
  --non-interactive \
  --public-base-url https://forge.example.com \
  --api-port 3000 \
  --web-port 5173 \
  --telegram-bot-token-ref env:TELEGRAM_BOT_TOKEN \
  --telegram-chat-id -100123 \
  --codex-auth-ref env:OPENAI_API_KEY \
  --runtime-env-file "$tmpdir/.env" \
  --setup-path "$tmpdir/setup.json"; then
  echo "expected setup to fail when OpenClaw discovery is missing" >&2
  exit 1
fi
test ! -f "$tmpdir/setup.json"
```

Result: passed. The setup command exited non-zero with:

```text
OpenClaw CLI is not installed or not on PATH. Next step: Install OpenClaw and complete gateway onboarding, then rerun npm run setup:vps.
```

No setup JSON was created.

## Configure-Later Positive Proof

Command:

```bash
tmpdir=$(mktemp -d /tmp/auto-forge-qa-configure-later-XXXXXX)
npm run setup:vps -- \
  --non-interactive \
  --openclaw-mode configure-later \
  --openclaw-base-url http://localhost:18789 \
  --public-base-url https://forge.example.com \
  --api-port 3000 \
  --web-port 5173 \
  --telegram-bot-token-ref env:TELEGRAM_BOT_TOKEN \
  --telegram-chat-id -100123 \
  --codex-auth-ref env:OPENAI_API_KEY \
  --runtime-env-file "$tmpdir/.env" \
  --setup-path "$tmpdir/setup.json"
grep -q '"mode": "configure-later"' "$tmpdir/setup.json"
grep -q '"status": "configure-later"' "$tmpdir/setup.json"
```

Result: passed. Setup JSON recorded both `mode: "configure-later"` and `status: "configure-later"`.

## Verification Run

```bash
npm run test -- --run tests/vps-setup-wizard.test.ts
```

Result: passed. `1` file, `9` tests.

```bash
npm run verify
```

Result: passed. ESLint, TypeScript, schema check, and Vitest passed: `14` files, `54` tests.

```bash
npm run full-rebuild
```

Result: passed. Completed fresh bootstrap, verify, install-check, runtime health, references-only backup/restore, recovery dry run, task/service log discovery, Docker Compose build/up/smoke, and cleanup.

```bash
npm run live:smoke
```

Result: exited `BLOCKED_EXTERNAL` because staged/live external credentials are not present:

- `OPENCLAW_BASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_TEST_CHAT_ID`
- `OPENAI_API_KEY`

## Blockers Or Residual Risks

- No local implementation blocker remains for `61-phase-5-revision-openclaw-fail-closed.md`.
- Final go-live proof remains externally blocked until staged or live OpenClaw, Telegram, and OpenAI credentials are supplied and `npm run live:smoke` passes.

## Durable Memory Candidates

- Non-interactive default OpenClaw setup fails closed when gateway discovery fails and no explicit gateway URL is provided.
- `configure-later` is the only incomplete setup path that may write setup JSON without proven OpenClaw gateway reachability.
- Explicit OpenClaw gateway URL fallback is recorded as manual setup metadata, not CLI discovery.

## QA Status

`BLOCKED_EXTERNAL`
