# Phase 5 Env File Flag Revision Stop

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-28T19:07:52Z`
Stop status: `BLOCKED_EXTERNAL`

## Phase Addressed

- `56-phase-5-revision-env-file-flag.md`
- Execution mode: `FINAL_SHIPGATE_REVISION`
- Validation level: `FULL_REBUILD`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Implementation commit SHA: `7b8e6eb4c23a5248784bb908bbd64d34b9ecfe33`
- Stop report commit SHA: `4cdabc930b2e0d0a39535b8e67b5f90281106c3f`
- Push status: pushed. Stop report commit `4cdabc930b2e0d0a39535b8e67b5f90281106c3f` is contained in `origin/main`.

## Exact Replacement Flag

The unsafe user-facing setup wizard option `--env-file` was replaced with:

```bash
--runtime-env-file
```

The interactive and non-interactive setup wizard paths now read `--runtime-env-file`, and the CLI help text and deployment docs document only the Node-safe flag for `npm run setup:vps -- ...`.

## Files Changed

- `apps/cli/src/index.ts`
- `docs/deployment/README.md`
- `docs/deployment/vps.md`
- `tests/vps-setup-wizard.test.ts`

## Implementation Summary

- Updated the setup wizard env output option from `--env-file` to `--runtime-env-file` in both interactive and non-interactive code paths.
- Updated setup CLI help and VPS deployment docs so the documented npm-run path no longer exposes Node's intercepted `--env-file` flag.
- Added a deterministic Vitest case that invokes the real `npm run setup:vps -- --runtime-env-file <missing-path>` command and asserts the env file is created with mode `0600`.
- Asserted the setup JSON from that command remains references-only and does not contain `raw-` secret values.

## Missing Env File Proof

Command run:

```bash
tmpdir=$(mktemp -d /tmp/auto-forge-setup-qa-XXXXXX)
npm run setup:vps -- \
  --non-interactive \
  --public-base-url https://forge.example.com \
  --api-port 3000 \
  --web-port 5173 \
  --openclaw-base-url https://openclaw.example.com \
  --openclaw-token-ref env:OPENCLAW_TOKEN \
  --telegram-bot-token-ref env:TELEGRAM_BOT_TOKEN \
  --telegram-chat-id -100123 \
  --codex-auth-ref env:OPENAI_API_KEY \
  --runtime-env-file "$tmpdir/.env" \
  --setup-path "$tmpdir/setup.json"
stat -c '%a %n' "$tmpdir/.env"
grep -q 'env:OPENCLAW_TOKEN' "$tmpdir/setup.json"
grep -q 'raw-' "$tmpdir/setup.json" && exit 1 || true
```

Result: passed.

- Created env file: `/tmp/auto-forge-setup-qa-gWkZ3Q/.env`
- Env file mode: `600`
- Setup JSON path: `/tmp/auto-forge-setup-qa-gWkZ3Q/setup.json`
- Setup JSON references-only proof: `grep -q 'env:OPENCLAW_TOKEN'` passed and `grep -q 'raw-'` found no matches.

## Verification Run

```bash
npm run verify
```

Result: passed. ESLint, TypeScript, schema check, and Vitest passed: 14 files, 48 tests.

```bash
npm run full-rebuild
```

Result: passed. Completed fresh bootstrap, verify, install-check, runtime health, references-only backup/restore, recovery dry run, task/service log discovery, Docker Compose build/up/smoke, and cleanup.

Live external credential availability was checked without printing values. These required variables are missing:

- `OPENCLAW_BASE_URL`
- `OPENCLAW_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_TEST_CHAT_ID`
- `OPENAI_API_KEY`

Because credentials are unavailable in this worker shell, `npm run live:smoke` remains externally blocked.

## Blockers Or Residual Risks

- The setup wizard env file flag bug is fixed and deterministically proven.
- The remaining Phase 5 blocker is external: staged or live Telegram/OpenClaw/OpenAI credentials are still required before `npm run live:smoke` and final go-live QA can clear.

## Durable Memory Candidates

- Fresh VPS setup must document `--runtime-env-file` for operator-selected service env files; `--env-file` is unsafe through the current `npm run setup:vps` Node/tsx invocation.
- Setup JSON remains references-only; selected runtime env files are created or updated with mode `0600`.
- Final go-live still requires live `npm run live:smoke` with `OPENCLAW_BASE_URL`, `OPENCLAW_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_TEST_CHAT_ID`, and `OPENAI_API_KEY`.

## QA Status

`BLOCKED_EXTERNAL`
