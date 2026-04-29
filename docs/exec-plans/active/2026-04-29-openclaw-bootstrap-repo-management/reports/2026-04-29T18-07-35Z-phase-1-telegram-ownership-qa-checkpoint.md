# Phase 1 Revision QA Checkpoint - Telegram Ownership Boundary

- stop_status: `QA_CHECKPOINT`
- phase: `11-phase-1-revision-telegram-ownership.md`
- implementation_commit_sha: `aa034144215d78d0ae855e98d64037e69b4e2920`
- stop_report_commit_sha: `PENDING_STOP_REPORT_COMMIT`

## Files Changed

- `scripts/install-vps.sh`
- `tests/vps-installer.test.ts`
- `docs/deployment/vps.md`
- `docs/exec-plans/active/2026-04-29-openclaw-bootstrap-repo-management/reports/2026-04-29T18-07-35Z-phase-1-telegram-ownership-qa-checkpoint.md`
- `docs/exec-plans/active/2026-04-29-openclaw-bootstrap-repo-management/reports/LATEST.md`
- `docs/exec-plans/active/2026-04-29-openclaw-bootstrap-repo-management/reports/LATEST.json`
- `docs/exec-plans/active/2026-04-29-openclaw-bootstrap-repo-management/automation/state.json`
- `docs/exec-plans/active/2026-04-29-openclaw-bootstrap-repo-management/automation/qa.json`

## Telegram Ownership Fix

Default same-bot OpenClaw Telegram channel provisioning was removed from the VPS installer path.

The installer no longer:

- writes `/root/.openclaw/.env` with `TELEGRAM_BOT_TOKEN`
- writes `/root/.openclaw/telegram-bot-token`
- sets `channels.telegram.enabled true`
- sets `channels.telegram.tokenFile`
- sets `channels.telegram.defaultTo`
- configures OpenClaw Telegram DM/group allowlists from the Auto Forge operator chat

The default `install-or-onboard` path now keeps OpenClaw's Telegram channel disabled, removes stale `tokenFile` and `defaultTo` entries from `openclaw.json`, and uses `openclaw config set channels.telegram.enabled false` where the CLI path is available.

No optional same-bot OpenClaw Telegram mode was added. Operator-facing docs now state that `AUTO_FORGE_REQUIRE_OPENCLAW_TELEGRAM_DELIVERY=1` is only for an explicitly separate OpenClaw Telegram channel configured outside the default installer path.

## Managed OpenClaw Bootstrap Preserved

The installer still runs the managed OpenClaw workspace bootstrap in `OPENCLAW_SETUP_MODE=install-or-onboard`:

```text
run_managed_openclaw_bootstrap "$repo_dir"
bash "$repo_dir/scripts/setup-openclaw.sh" --workspace-dir "$workspace_dir"
```

The local gateway config remains intact, including:

- `openclaw config set gateway.mode local`
- `openclaw config set gateway.port 18789`
- `openclaw config set agents.defaults.workspace /root/.openclaw/workspace`
- `openclaw config validate`

## Auto Forge Webhook Ownership Proof

Auto Forge remains the sole inbound Telegram owner for the configured bot. `scripts/install-vps.sh` still derives the Telegram webhook from:

```text
${PUBLIC_BASE_URL%/}/telegram/webhook
```

and still registers it through Telegram `setWebhook` with `allowed_updates: ["message"]` and the `TELEGRAM_WEBHOOK_SECRET` header. The install-or-onboard dry run proves the installer plans to:

```text
register and verify Telegram webhook at https://forge.example.com/telegram/webhook
```

`npm run live:smoke` remains compatible with the new boundary because OpenClaw CLI Telegram delivery is optional unless `AUTO_FORGE_REQUIRE_OPENCLAW_TELEGRAM_DELIVERY=1` is set.

## Validation Run

- `bash -n scripts/install-vps.sh`: passed
- `bash -n scripts/setup-openclaw.sh`: passed
- `npm run test -- --run tests/vps-installer.test.ts tests/openclaw-bootstrap.test.ts`: passed, 2 files / 20 tests
- `npm run verify`: passed, 16 files / 91 tests
- `npm run full-rebuild`: passed, including fresh bootstrap, verify, install-check, health, backup/restore dry run, recovery/log discovery, Docker Compose build/up/smoke, and cleanup

## Dirty Repo Note

An unrelated untracked `tools/forge/__pycache__/` directory existed before this work and was left unmodified and uncommitted.

## Durable Memory Candidates

- The default VPS installer path must not configure OpenClaw Telegram channel ownership for the Auto Forge bot.
- Auto Forge owns inbound Telegram for the configured bot through `${PUBLIC_BASE_URL%/}/telegram/webhook`.
- OpenClaw remains a managed local gateway/workspace helper in Phase 1; any future OpenClaw Telegram channel must be explicit and separate from the Auto Forge bot ownership path.

## QA Gate

Stop here at `QA_CHECKPOINT`. Do not start Phase 2 until QA clears this revision.
