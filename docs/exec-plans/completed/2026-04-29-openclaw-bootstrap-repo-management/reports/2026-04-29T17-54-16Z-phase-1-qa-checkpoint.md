# Phase 1 QA Checkpoint - Managed OpenClaw Bootstrap

- stop_status: `QA_CHECKPOINT`
- phase: `10-phase-1-managed-openclaw-bootstrap.md`
- implementation_commit_sha: `a4280bbf9b57041fefc3e1f40f5306a50edcd8cc`
- stop_report_commit_sha: `06ae00574ad60d8a6dcd961dbe226323638285cf`

## Files Changed

- `assets/openclaw-workspace/AGENTS.md`
- `assets/openclaw-workspace/SOUL.md`
- `assets/openclaw-workspace/USER.md`
- `assets/openclaw-workspace/IDENTITY.md`
- `assets/openclaw-workspace/TOOLS.md`
- `assets/openclaw-workspace/HEARTBEAT.md`
- `packages/ops/src/openclaw-bootstrap.ts`
- `packages/ops/src/index.ts`
- `tools/setup-openclaw.ts`
- `scripts/setup-openclaw.sh`
- `scripts/install-vps.sh`
- `tests/openclaw-bootstrap.test.ts`
- `tests/vps-installer.test.ts`

## Generated OpenClaw Files

The managed bootstrap creates these workspace files under `/root/.openclaw/workspace` during VPS `install-or-onboard` setup:

- `AGENTS.md`
- `SOUL.md`
- `USER.md`
- `IDENTITY.md`
- `TOOLS.md`
- `HEARTBEAT.md`

Each file includes the `AUTO_FORGE_MANAGED_OPENCLAW_WORKSPACE v1` marker. `BOOTSTRAP.md` is removed from the active workspace. If an unmanaged `BOOTSTRAP.md` exists, it is backed up before removal.

## Existing Unmanaged Files

Existing files without the managed marker are not overwritten silently. The bootstrap renames them to `*.auto-forge-backup-<timestamp>` before writing the managed version. Existing managed files are updated in place and idempotent reruns leave unchanged content alone.

## Installer Integration Proof

`scripts/install-vps.sh` now calls `bash "$repo_dir/scripts/setup-openclaw.sh" --workspace-dir "$workspace_dir"` from `ensure_openclaw_gateway "$repo_dir"` when `OPENCLAW_SETUP_MODE=install-or-onboard`.

The wrapper invokes `tools/setup-openclaw.ts`, which:

- creates the managed workspace directory at mode `0700`
- writes managed markdown files at mode `0600`
- sets `gateway.mode`, `gateway.port`, and `agents.defaults.workspace` through `openclaw config set`
- runs `openclaw config validate`

The installer also validates OpenClaw config after Telegram channel config and before gateway restart.

## Public URL And Telegram Ownership

The public URL remains dynamic. The installer still derives the Telegram webhook from:

```text
${PUBLIC_BASE_URL%/}/telegram/webhook
```

No `hopfner.dev` runtime URL was introduced. Telegram inbound ownership remains Auto Forge-owned through `setWebhook` with `allowed_updates: ["message"]`. Phase 1 does not add OpenClaw long polling or OpenClaw-owned inbound webhook setup for the same bot.

## Secret Handling

The generated workspace templates contain no raw Telegram, OpenAI, OpenClaw, or SSH secrets. Setup JSON behavior remains references-only; this phase did not add secret values to setup JSON.

## Validation Run

- `bash -n scripts/install-vps.sh`: passed
- `bash -n scripts/setup-openclaw.sh`: passed
- `npm run test -- --run tests/vps-installer.test.ts tests/openclaw-bootstrap.test.ts`: passed, 2 files / 18 tests
- `npm run verify`: passed, 16 files / 89 tests
- deterministic temp workspace proof: passed; all required files existed, managed markers were present, `BOOTSTRAP.md` was absent, secret scan passed, and 4 OpenClaw config commands including `config validate` ran
- `npm run full-rebuild`: passed, including verify, install-check, health, backup/restore dry run, recovery/log discovery, Docker Compose build/up/smoke, and cleanup

## Live Proof

`npm run live:smoke` was not run because this coding shell has no live/staged external values set for `OPENCLAW_BASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_TEST_CHAT_ID`, `OPENAI_API_KEY`, or `CODEX_AUTH_REF`. Per the phase brief, live proof can run on the test VPS after QA because Phase 1 is not blocked solely by missing credentials.

## Durable Memory Candidates

- VPS `install-or-onboard` now runs a managed OpenClaw workspace bootstrap before gateway restart.
- The managed OpenClaw workspace files are `AGENTS.md`, `SOUL.md`, `USER.md`, `IDENTITY.md`, `TOOLS.md`, and `HEARTBEAT.md`.
- Managed workspace reruns back up unmanaged files and remove active `BOOTSTRAP.md` so generic OpenClaw first-run bootstrap does not take over.
- OpenClaw config validation is now required before gateway restart in the installer path.

## QA Gate

Stop here at `QA_CHECKPOINT`. Do not start Phase 2 until QA clears Phase 1.
