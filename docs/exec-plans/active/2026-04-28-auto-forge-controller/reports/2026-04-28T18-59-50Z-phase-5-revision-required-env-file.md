# Phase 5 Revision Required - Env File Flag

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-28T18:59:50Z`
Stop status: `REVISION_PACK_REQUIRED`

## Phase Reviewed

- `55-phase-5-revision-vps-setup-wizard.md`
- New revision authorized: `56-phase-5-revision-env-file-flag.md`

## Finding

The setup wizard uses and documents `--env-file`, but that flag is intercepted by Node/tsx before the app can create the selected env file. This breaks the fresh-VPS flow for paths like `/etc/auto-forge-controller/auto-forge.env`.

Reproduction:

```bash
tmpdir=$(mktemp -d /tmp/auto-forge-setup-qa-XXXXXX)
runuser -u tyler -- npm run setup:vps -- --non-interactive --public-base-url https://forge.example.com --api-port 3000 --web-port 5173 --openclaw-base-url https://openclaw.example.com --openclaw-token-ref env:OPENCLAW_TOKEN --telegram-bot-token-ref env:TELEGRAM_BOT_TOKEN --telegram-chat-id -100123 --codex-auth-ref env:OPENAI_API_KEY --env-file "$tmpdir/.env" --setup-path "$tmpdir/setup.json"
```

Observed:

```text
node: /tmp/.../.env: not found
```

Finding type: `execution_miss`.

## Verification Performed

```bash
runuser -u tyler -- npm run verify
```

Result: passed. ESLint, TypeScript, schema check, and Vitest passed: 14 files, 47 tests.

```bash
runuser -u tyler -- npm run setup:vps -- --non-interactive --dry-run --public-base-url https://forge.example.com --api-port 3000 --web-port 5173 --openclaw-base-url https://openclaw.example.com --openclaw-token-ref env:OPENCLAW_TOKEN --telegram-bot-token-ref env:TELEGRAM_BOT_TOKEN --telegram-chat-id -100123 --codex-auth-ref env:OPENAI_API_KEY
```

Result: passed. The normal dry-run path works, which narrows the failure to the documented custom env-file path.

## Required Revision

Implement `56-phase-5-revision-env-file-flag.md`.

## Current Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Failing implementation commit SHA: `bcf909d7e86dc3ff9b3e53e34a5a968e6d51f26c`
- Current pushed HEAD before this revision pack: `45e2c24cdc7a45c35fd2438508b699777e72ca63`
- QA revision-pack commit SHA: `53426a0bea43888b494d5c44d45a3519ed9a49bb`

## QA Status

`REVISION_PACK_REQUIRED`
