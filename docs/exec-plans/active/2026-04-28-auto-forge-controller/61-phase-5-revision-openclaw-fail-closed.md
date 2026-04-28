# Phase 5 Revision - OpenClaw Discovery Fail-Closed

Execution mode: `FINAL_SHIPGATE_REVISION`
Validation level: `FULL_REBUILD`
Stop gate: `QA_CHECKPOINT`

## Why This Revision Exists

QA found that `59-phase-5-revision-openclaw-bootstrap.md` mostly landed, but the default non-interactive setup path can still report success after OpenClaw discovery fails.

The current failure case:

- `openclaw` CLI is missing from `PATH`
- no explicit OpenClaw gateway URL is supplied
- setup mode defaults to `detect-existing`
- `npm run setup:vps -- --non-interactive ...` exits `0`
- setup JSON is written with `mode: "detect-existing"` and `discovery.status: "missing-cli"`

This violates the phase's fail-closed rule. If gateway discovery is not proven, setup must not silently write a successful default gateway setup.

## Required Fix

Make OpenClaw discovery fail closed in the default non-interactive path.

Required behavior:

- `detect-existing` with successful CLI discovery: continue and write setup.
- `detect-existing` with an explicit `--openclaw-base-url`: continue only if the setup truthfully records manual/explicit gateway configuration. Do not pretend CLI discovery succeeded.
- `detect-existing` with no CLI discovery and no explicit URL: exit non-zero with a clear message and next step.
- `install-or-onboard`: exit non-zero or dry-run with exact OpenClaw install/onboard next steps; do not write a successful setup artifact unless gateway discovery later succeeds or the operator explicitly switches to `configure-later`.
- `configure-later`: may write incomplete setup, but setup JSON and env must truthfully record `mode: "configure-later"` and health/live smoke must report blocked until OpenClaw onboarding is complete.
- `advanced-webhook`: existing explicit auth-reference behavior can remain, but raw values must never enter setup JSON.

## Implementation Targets

- `apps/cli/src/index.ts`
- `packages/ops/src/openclaw-setup.ts`
- `packages/ops/src/vps-setup.ts`
- `tests/vps-setup-wizard.test.ts`
- docs only if command/help behavior changes
- active brief reports and automation files

## Required Tests

Add or update targeted tests proving:

- default non-interactive `detect-existing` exits non-zero when `openclaw` CLI is missing and no explicit `--openclaw-base-url` is supplied
- the failed default path does not create a misleading setup JSON
- `configure-later` still writes incomplete setup intentionally
- explicit URL fallback is recorded as manual/explicit rather than CLI-detected
- existing no-token and references-only tests still pass

## Required Proof Command

Run this exact negative proof and report the result:

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

Also run a positive configure-later proof:

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

## Required Validation

Run and report:

```bash
npm run verify
npm run full-rebuild
```

If live credentials are available, run:

```bash
npm run live:smoke
```

If live credentials are unavailable, stop as `BLOCKED_EXTERNAL` only after the fail-closed negative proof, configure-later positive proof, `npm run verify`, and `npm run full-rebuild` pass.

## Completion Report

Write a timestamped report under `reports/`, refresh `reports/LATEST.md`, refresh `reports/LATEST.json`, update `automation/state.json` and `automation/qa.json`, commit, push, and report:

- files changed
- exact fail-closed behavior implemented
- negative proof result
- configure-later proof result
- tests run
- implementation commit SHA
- stop report commit SHA
- push status

## QA Gate

QA cannot accept this revision until default OpenClaw discovery failure no longer writes a successful setup artifact.
