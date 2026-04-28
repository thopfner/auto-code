# Phase 5 Fresh VPS Setup Wizard Stop

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-28T18:56:47Z`
Stop status: `BLOCKED_EXTERNAL`

## Phase Addressed

- `55-phase-5-revision-vps-setup-wizard.md`
- Execution mode: `FINAL_SHIPGATE_REVISION`
- Validation level: `FULL_REBUILD`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Implementation commit SHA: `bcf909d7e86dc3ff9b3e53e34a5a968e6d51f26c`
- Stop report commit SHA: `9bc20ffac5165f985b4acd1af7c2863f05593766`
- Push status: pushed. Stop report commit `9bc20ffac5165f985b4acd1af7c2863f05593766` is contained in `origin/main`.

## Exact Setup Command

```bash
npm run setup:vps
```

The command is also exposed through the existing CLI as:

```bash
npm run auto-forge -- setup-vps
```

For deterministic scripted installs and tests, the same artifact generation is available with:

```bash
npm run setup:vps -- --non-interactive --public-base-url <url> --openclaw-base-url <url>
```

## Files Changed

- `.env.example`
- `package.json`
- `apps/cli/src/index.ts`
- `packages/ops/src/index.ts`
- `packages/ops/src/install-check.ts`
- `packages/ops/src/vps-setup.ts`
- `scripts/configure-nginx.sh`
- `tests/vps-setup-wizard.test.ts`
- `docs/deployment/README.md`
- `docs/deployment/vps.md`

## Implementation Summary

- Added a guided fresh-VPS setup command that collects the controller public URL, Nginx preference, upstream ports, OpenClaw settings, Telegram token/chat ID, and Codex auth mode.
- Added deterministic Nginx config generation for `/` to web and `/health`, `/live`, `/setup`, `/telegram/command`, `/approvals/*`, `/workflow/*`, and `/tasks` to API.
- Added an OS-level Nginx wrapper at `scripts/configure-nginx.sh` that stops on missing Nginx or conflicting non-Auto-Forge site config, then tests and reloads Nginx when permitted.
- Added secret-reference setup persistence so `.auto-forge/setup.json` stores `env:` or `secret:` references only.
- Added env-file block writing with mode `0600`; raw values entered interactively are limited to the ignored env file selected by the operator.
- Added Telegram `getUpdates` chat-ID discovery.
- Added Codex API-key default auth and an explicit trusted-machine OAuth path that runs `codex login` without copying auth caches.
- Added deterministic tests for Nginx route generation, secret-reference persistence, `0600` env writing, and Telegram chat discovery.

## Nginx Result

Nginx was not actually configured in this worker shell. The command was exercised in non-interactive dry-run mode and generated the deterministic config for review. On a VPS, the wizard writes `.auto-forge/nginx/<domain>.conf` and can install it with:

```bash
sudo bash scripts/configure-nginx.sh .auto-forge/nginx/<domain>.conf <domain>
```

The generated config includes the TLS note required before Telegram webhook production use. It does not include OpenClaw, Telegram, or Codex tokens.

## Secret Handling

Secrets are written only to the operator-selected ignored env file, usually `.env` or `/etc/auto-forge-controller/auto-forge.env`. The writer sets file mode `0600`.

The setup record uses references only:

- OpenClaw token: `env:OPENCLAW_TOKEN` by default
- Telegram bot token: `env:TELEGRAM_BOT_TOKEN` by default
- Codex API key: `CODEX_AUTH_REF=env:OPENAI_API_KEY` by default

No raw token values were added to tracked docs, generated Nginx config, setup JSON, reports, or Git-tracked files.

## Telegram Chat ID Discovery

If the operator enters `discover` for the Telegram chat ID, the wizard resolves the bot token from the raw prompt value or `env:TELEGRAM_BOT_TOKEN`, calls Telegram `getUpdates`, deduplicates returned message/channel chat IDs, prints the discovered chat IDs and labels, and asks which ID to persist. If no chats are returned, the operator must send a message to the bot and rerun setup.

## OpenClaw Settings Handling

No OpenClaw settings mutation API is available in this repo. The wizard therefore prints the exact controller endpoint the operator must paste into OpenClaw:

```text
https://<controller-domain>/telegram/command
```

After the operator confirms the OpenClaw-side settings, the wizard validates OpenClaw health and routed Telegram delivery through the existing setup validation path.

## Codex Auth Handling

The default path is API-key auth:

- write or reference `OPENAI_API_KEY`
- set `CODEX_AUTH_REF=env:OPENAI_API_KEY`
- verify `codex --version` and `codex exec --help`
- offer to run `npm run live:smoke`

The OAuth/manual-login path is gated by an explicit trusted-machine confirmation, runs `codex login`, and stores only `secret:codex-oauth-local-cache` as the reference. It does not copy auth caches into the repo or backup bundle.

## Verification Run

```bash
npm run verify
```

Result: passed. ESLint, TypeScript, schema check, and Vitest passed: 14 files, 47 tests.

```bash
npm run setup:vps -- --non-interactive --dry-run --public-base-url https://forge.example.com --api-port 3000 --web-port 5173 --openclaw-base-url https://openclaw.example.com --openclaw-token-ref env:OPENCLAW_TOKEN --telegram-bot-token-ref env:TELEGRAM_BOT_TOKEN --telegram-chat-id -100123 --codex-auth-ref env:OPENAI_API_KEY
```

Result: passed. Dry-run output contained setup references and Nginx config only, with no raw tokens.

```bash
npm run full-rebuild
```

Result: passed. Completed fresh bootstrap, verify, install-check, runtime health, references-only backup/restore, recovery dry run, task/service log discovery, Docker Compose build/up/smoke, and cleanup.

```bash
npm run live:smoke
```

Result: blocked externally. Output status: `BLOCKED_EXTERNAL`.

Missing external credentials:

- `OPENCLAW_BASE_URL`
- `OPENCLAW_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_TEST_CHAT_ID`
- `OPENAI_API_KEY`

## Blocker

Live credentials are unavailable in this worker shell, so the live `npm run setup:vps` validation and `npm run live:smoke` cannot complete against real Telegram, OpenClaw, and OpenAI/Codex services. This is the only remaining blocker from this revision.

## Durable Memory Candidates

- Fresh VPS setup now has a concrete command: `npm run setup:vps`.
- Setup state remains references-only; raw credentials belong only in ignored env files or service-managed secret stores.
- Nginx setup is deterministic and reviewable; actual install/reload is delegated to `scripts/configure-nginx.sh`.
- Final go-live still requires live `npm run setup:vps` and `npm run live:smoke` with real credentials.

## QA Status

`BLOCKED_EXTERNAL`
