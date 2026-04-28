# Phase 5 OpenClaw Fail-Closed QA

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-28T21:27:04Z`
Stop status: `BLOCKED_EXTERNAL`

## Phase Reviewed

- `61-phase-5-revision-openclaw-fail-closed.md`
- Execution mode: `FINAL_SHIPGATE_REVISION`
- Validation level: `FULL_REBUILD`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Accepted implementation commit SHA: `f8a61bc5e6923c15f87b963f4df9ec9bcce0fe83`
- Worker stop report commit SHA: `a8e556d38d2b70ea797910104adcf47c112bcb72`
- QA report commit SHA: `e5dbd48065e474f6cd8922991421c1914dd91178`
- Pushed HEAD before QA report: `cd2b7f6e045b4095f1f48ae9cf2bb4c26807549b`

## QA Finding

No implementation findings remain for `61-phase-5-revision-openclaw-fail-closed.md`.

The previously blocking OpenClaw default discovery issue is fixed. Non-interactive default `detect-existing` now fails closed when the OpenClaw CLI is unavailable and no explicit gateway URL is supplied, writes no setup JSON, and writes no selected env file. `configure-later` remains the explicit incomplete setup path, and explicit `--openclaw-base-url` fallback records manual discovery metadata rather than pretending CLI detection succeeded.

Final Phase 5 clearance remains blocked only by unavailable live external credentials for OpenClaw, Telegram, and OpenAI/Codex.

## Validation Performed

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
  exit 1
fi
test ! -f "$tmpdir/setup.json"
test ! -f "$tmpdir/.env"
```

Result: passed. The command exited non-zero with the OpenClaw onboarding next step, and neither setup JSON nor the selected env file was created.

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
test "$(stat -c '%a' "$tmpdir/.env")" = "600"
```

Result: passed. Setup JSON recorded `mode: "configure-later"` and `status: "configure-later"`; the missing selected env file was created with mode `600`.

```bash
tmpdir=$(mktemp -d /tmp/auto-forge-qa-explicit-openclaw-XXXXXX)
PATH=/usr/bin:/bin npm run setup:vps -- \
  --non-interactive \
  --openclaw-base-url https://openclaw.example.com \
  --public-base-url https://forge.example.com \
  --api-port 3000 \
  --web-port 5173 \
  --telegram-bot-token-ref env:TELEGRAM_BOT_TOKEN \
  --telegram-chat-id -100123 \
  --codex-auth-ref env:OPENAI_API_KEY \
  --runtime-env-file "$tmpdir/.env" \
  --setup-path "$tmpdir/setup.json"
grep -q '"source": "manual"' "$tmpdir/setup.json"
grep -q '"status": "detected"' "$tmpdir/setup.json"
```

Result: passed. Explicit fallback setup records manual discovery, keeps setup JSON references-only, and creates the selected env file with mode `600`.

```bash
npm run verify
```

Initial result: failed before tests because `node_modules/.vite-temp` was root-owned. QA repaired ignored local `node_modules` ownership only.

Second result: passed. ESLint, TypeScript, schema check, and Vitest passed: 14 files, 54 tests.

```bash
npm run full-rebuild
```

Initial result: failed during fresh bootstrap because root-owned files in ignored `node_modules` prevented `npm ci` from replacing binaries. QA repaired ignored local `node_modules` ownership only.

Second result: passed. Completed fresh bootstrap, verify, install-check, runtime health, references-only backup/restore, recovery dry run, task/service log discovery, Docker Compose build/up/smoke, and cleanup.

```bash
npm run live:smoke
```

Result: `BLOCKED_EXTERNAL`.

Missing:

- `OPENCLAW_BASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_TEST_CHAT_ID`
- `OPENAI_API_KEY`

## Accepted Coverage

- `61-phase-5-revision-openclaw-fail-closed.md` is accepted subject to live external validation.
- Default non-interactive OpenClaw detection now fails closed without setup artifacts when gateway discovery is unavailable.
- `configure-later` writes an explicit incomplete setup with mode/status `configure-later`.
- Explicit OpenClaw gateway fallback records manual discovery metadata.
- Setup JSON remains references-only.

## Brief-Local Hygiene

QA repaired the prior worker stop report metadata placeholder to `a8e556d38d2b70ea797910104adcf47c112bcb72`.

## Next Required Action

Provide staged or live values for:

- `OPENCLAW_BASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_TEST_CHAT_ID`
- `OPENAI_API_KEY`

Then run:

```bash
npm run setup:vps
npm run live:smoke
```

After those pass, QA can complete `90-final-qa-and-merge-gate.md`, update the memory pack through `99-memory-pack-update.md`, archive the active brief, and return `CLEAR_CURRENT_PHASE`.

## QA Status

`BLOCKED_EXTERNAL`
