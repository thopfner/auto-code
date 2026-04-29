# Phase 1 QA - Revision Required

- stop_status: `REVISION_PACK_REQUIRED`
- phase_reviewed: `10-phase-1-managed-openclaw-bootstrap.md`
- implementation_commit_sha: `a4280bbf9b57041fefc3e1f40f5306a50edcd8cc`
- worker_stop_report_commit_sha_claimed: `06ae00574ad60d8a6dcd961dbe226323638285cf`
- current_head_at_review: `956fb00cf8ef5d523ad6f28557e08e96cd160a79`

## Findings

### Blocking - OpenClaw Still Owns Telegram Runtime For The Same Bot

Type: `execution_miss`

The Phase 1 brief explicitly required Auto Forge to remain the sole Telegram inbound owner and said not to configure OpenClaw to own inbound Telegram for the same bot.

The implementation still configures OpenClaw Telegram channel startup in the default installer path:

- `scripts/install-vps.sh` writes `/root/.openclaw/.env` containing `TELEGRAM_BOT_TOKEN`
- `scripts/install-vps.sh` writes `/root/.openclaw/telegram-bot-token`
- `scripts/install-vps.sh` writes `channels.telegram.enabled = true`
- `scripts/install-vps.sh` sets `channels.telegram.tokenFile`
- `scripts/install-vps.sh` sets `channels.telegram.defaultTo`
- `scripts/install-vps.sh` restarts the OpenClaw gateway after that channel config

OpenClaw's Telegram docs state that Telegram is owned by the gateway process and long polling is the default mode. That means the current implementation can compete with Auto Forge's webhook ownership for the same bot. Reasserting the webhook later is not a production-grade boundary; the default installer should not enable OpenClaw Telegram channel ownership for the Auto Forge bot.

Required correction: preserve the managed OpenClaw workspace bootstrap, but remove default same-bot OpenClaw Telegram channel provisioning or put any OpenClaw Telegram channel support behind a clearly explicit advanced opt-in that cannot silently compete with the Auto Forge webhook.

## Non-Blocking Brief Hygiene

The worker added commit `956fb00cf8ef5d523ad6f28557e08e96cd160a79` after `06ae00574ad60d8a6dcd961dbe226323638285cf` to record the report SHA. The previous `reports/LATEST.*` still points at `06ae00574ad60d8a6dcd961dbe226323638285cf`. This QA pass supersedes that latest state with this revision-required report.

An unrelated untracked path exists: `tools/forge/__pycache__/`. QA did not modify or remove it.

## Checks Run

```bash
bash -n scripts/install-vps.sh
bash -n scripts/setup-openclaw.sh
npm run test -- --run tests/vps-installer.test.ts tests/openclaw-bootstrap.test.ts
```

Results:

- bash syntax checks passed
- targeted tests passed: 2 files, 18 tests

`npm run verify` and `npm run full-rebuild` were not rerun by QA because the blocking issue is visible in the implementation and tests currently assert the wrong same-bot OpenClaw Telegram configuration.

## Revision Pack

Added:

- `11-phase-1-revision-telegram-ownership.md`
- `12-phase-1-revision-worker-handoff.md`

## Durable Memory Candidates

- Auto Forge must be the only inbound owner for the configured Telegram bot.
- OpenClaw Telegram channel startup should not be enabled for the Auto Forge bot by default because OpenClaw owns Telegram runtime behavior when that channel is enabled.

## QA Status

`REVISION_PACK_REQUIRED`

