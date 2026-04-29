# Phase 1 Revision - Telegram Ownership Boundary

Execution mode: `QA_CHECKPOINT`
Validation level: `FULL_REBUILD`
Read mode: `BRIEF_REHYDRATE`
Supersedes the incomplete parts of: `10-phase-1-managed-openclaw-bootstrap.md`

## Why This Revision Exists

Phase 1 implementation added the managed OpenClaw workspace bootstrap correctly, but it still configures OpenClaw's Telegram channel for the same bot by default:

- writes `/root/.openclaw/.env` with `TELEGRAM_BOT_TOKEN`
- writes `/root/.openclaw/telegram-bot-token`
- writes `channels.telegram.enabled: true`
- sets `channels.telegram.tokenFile`
- sets `channels.telegram.defaultTo`
- restarts the OpenClaw gateway with those settings

That violates the brief invariant:

```text
One Telegram bot must have one inbound owner.
Auto Forge owns Telegram inbound webhook traffic.
OpenClaw must not compete for the same bot.
```

OpenClaw's Telegram docs state that Telegram is owned by the gateway process and that long polling is the default mode. Therefore enabling the OpenClaw Telegram channel for the same Auto Forge bot is unsafe even if Auto Forge later reasserts its webhook.

## Production-Grade Acceptance Bar

Preserve the accepted managed workspace bootstrap work, but remove same-bot Telegram channel ownership from the default installer path.

Production-grade means:

- Auto Forge remains the sole inbound Telegram owner for the configured bot.
- The installer still creates managed OpenClaw workspace files.
- The installer still validates OpenClaw config.
- The installer still registers and verifies the Auto Forge Telegram webhook.
- OpenClaw gateway health remains available.
- Live smoke does not require OpenClaw CLI Telegram delivery in the default mode.
- Any optional OpenClaw Telegram channel mode must be explicit, documented as advanced, and must not silently reuse the Auto Forge bot in a way that competes with the webhook.

## Required Fix

1. Remove default OpenClaw Telegram channel provisioning from `scripts/install-vps.sh`.
   - Do not write `/root/.openclaw/.env` with `TELEGRAM_BOT_TOKEN` for OpenClaw by default.
   - Do not write `/root/.openclaw/telegram-bot-token` by default.
   - Do not set `channels.telegram.enabled true` by default.
   - Do not set `channels.telegram.tokenFile` or `channels.telegram.defaultTo` by default.
2. Keep managed OpenClaw workspace bootstrap in `OPENCLAW_SETUP_MODE=install-or-onboard`.
3. Keep OpenClaw local gateway config and `openclaw config validate`.
4. Ensure Auto Forge Telegram webhook registration still happens through `${PUBLIC_BASE_URL%/}/telegram/webhook`.
5. Adjust `npm run live:smoke` expectations or installer messaging so default mode treats OpenClaw Telegram CLI delivery as optional/skipped, not a launch blocker.
6. If an explicit advanced OpenClaw Telegram channel mode is kept or added, require clear opt-in and fail closed when it would conflict with the Auto Forge bot webhook.

## Owned Paths

Expected owned paths:

- `scripts/install-vps.sh`
- `tests/vps-installer.test.ts`
- `tools/live-external-smoke.ts` only if default live-smoke behavior needs adjustment
- `docs/deployment/**` only if operator-facing docs mention OpenClaw Telegram delivery
- `docs/exec-plans/active/2026-04-29-openclaw-bootstrap-repo-management/**`

Do not rewrite the managed workspace templates unless needed for this fix.

## Required Tests

Add or update tests proving:

- default installer source does not set `channels.telegram.enabled true`
- default installer source does not set `channels.telegram.tokenFile`
- default installer source does not write the Auto Forge `TELEGRAM_BOT_TOKEN` into OpenClaw `.env`
- default dry-run output does not claim it will write OpenClaw Telegram channel config
- Auto Forge webhook registration still uses `${PUBLIC_BASE_URL%/}/telegram/webhook`
- managed OpenClaw bootstrap still runs for `install-or-onboard`
- live smoke default does not require OpenClaw CLI Telegram delivery

## Required Validation

Run and report:

```bash
bash -n scripts/install-vps.sh
bash -n scripts/setup-openclaw.sh
npm run test -- --run tests/vps-installer.test.ts tests/openclaw-bootstrap.test.ts
npm run verify
npm run full-rebuild
```

If live credentials are available on the VPS after implementation, rerun the installer and `npm run live:smoke` there to prove:

- Auto Forge webhook remains set
- Telegram `/status` works
- OpenClaw gateway health passes
- OpenClaw does not take over the same Telegram bot inbound path

## Stop Report Requirements

Write a new timestamped report under `reports/` and refresh:

- `reports/LATEST.md`
- `reports/LATEST.json`
- `automation/state.json`
- `automation/qa.json`

The report must include:

- exact files changed
- whether same-bot OpenClaw Telegram channel provisioning was removed or put behind an explicit opt-in
- proof Auto Forge remains the webhook owner
- tests run
- `implementation_commit_sha`
- `stop_report_commit_sha`

## Gate

Stop at `QA_CHECKPOINT`. Do not start Phase 2 until QA clears this revision.

