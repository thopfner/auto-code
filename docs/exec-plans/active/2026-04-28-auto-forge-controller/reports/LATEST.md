# Phase 5 Setup Wizard UX Smoothing Stop

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-29T07:10:12Z`
Stop status: `BLOCKED_EXTERNAL`

## Phase Addressed

- `68-phase-5-revision-setup-wizard-ux-smoothing.md`
- Execution mode: `FINAL_SHIPGATE_REVISION`
- Validation level: `FULL_REBUILD`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Implementation commit SHA: `7e7c4c5e38392c6721266effbf0c1eb246a7fee4`
- Stop report commit SHA: `858db6df11c521aed09d845c8eaafb973eadf8ee`
- Push status: pushed to `origin/main` through metadata commit `cc59ce3071ceee58dd5297c86098aab4c77241f7`.

## Files Changed

- `apps/cli/src/index.ts`
- `packages/ops/src/vps-setup.ts`
- `tests/vps-setup-wizard.test.ts`
- `docs/deployment/vps.md`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/2026-04-29T07-10-12Z-phase-5-setup-wizard-ux-smoothing.md`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/LATEST.md`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/LATEST.json`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/automation/state.json`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/automation/qa.json`

## Behavior Implemented

- Telegram chat discovery now uses a reusable `selectTelegramChatId()` helper that can retry `getUpdates` in place after an empty result.
- Empty Telegram updates print an instruction to message the bot, then let the operator choose retry discovery or manual chat ID entry from the same wizard step.
- Manual Telegram chat ID entry remains available before discovery and as a fallback after empty or failed discovery.
- Telegram discovery still does not return or persist the raw bot token; setup JSON stores references only.
- Codex API-key auth remains the default unattended path.
- Codex OAuth/manual auth no longer asks for a magic confirmation phrase and runs the managed Codex CLI as `login --device-auth`, then verifies with `login status`.
- The VPS deployment guide now documents in-place Telegram retry/manual fallback and the device-auth OAuth flow.

## Required Proof

```bash
npm run test -- --run tests/vps-setup-wizard.test.ts
```

Result: passed. `1` file, `12` tests.

```bash
npm run verify
```

Result: passed. ESLint, TypeScript, schema check, and Vitest passed: `14` files, `59` tests.

```bash
npm run full-rebuild
```

Result: passed. Completed fresh bootstrap, verify, install-check, runtime health, references-only backup/restore, recovery dry run, task/service log discovery, Docker Compose build/up/smoke, and cleanup.

```bash
rg -n "I UNDERSTAND|codex login(\\s|$)|--device-auth|Telegram getUpdates returned no chats|rerun setup" apps/cli/src/index.ts docs/deployment tests
```

Result: passed for the required proof. Output only showed device-auth usage:

```text
apps/cli/src/index.ts:528:      await runCommand(codex.command, ["login", "--device-auth"]);
tests/vps-setup-wizard.test.ts:379:    expect(source).toContain('["login", "--device-auth"]');
docs/deployment/vps.md:61:Codex defaults to API-key auth with `CODEX_AUTH_REF=env:OPENAI_API_KEY`. The OAuth/manual-login path is for trusted locked-down machines; it runs the repo-managed `codex login --device-auth` flow, verifies `codex login status`, and never copies auth caches into this repo or backup bundles. The final `npm run live:smoke` gate currently requires `OPENAI_API_KEY`.
```

The grep proof shows no remaining `I UNDERSTAND`, no `Telegram getUpdates returned no chats`, and no `rerun setup` setup-wizard text in the searched paths.

```bash
npm run live:smoke
```

Result: `BLOCKED_EXTERNAL`.

Missing:

- `OPENCLAW_BASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_TEST_CHAT_ID`
- `OPENAI_API_KEY`

## Blockers Or Residual Risks

- No local implementation blocker remains for `68-phase-5-revision-setup-wizard-ux-smoothing.md`.
- Final go-live proof remains externally blocked until staged or live OpenClaw, Telegram, and OpenAI credentials are supplied and `npm run live:smoke` passes.

## Durable Memory Candidates

- The VPS setup wizard can retry Telegram `getUpdates` in place and fall back to manual chat ID entry without restarting setup.
- Codex OAuth/manual setup uses the repo-managed Codex CLI with `login --device-auth` and `login status`; API-key auth remains the default unattended path.
- The setup wizard no longer uses magic confirmation phrases for Codex OAuth.

## QA Status

`BLOCKED_EXTERNAL`
