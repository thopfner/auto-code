# Phase 5 Revision - Setup Wizard UX Smoothing

Execution mode: `FINAL_SHIPGATE_REVISION`
Validation level: `FULL_REBUILD`
Stop gate: `QA_CHECKPOINT`

## Why This Revision Exists

Fresh launch testing found two setup wizard UX failures that block an elite SaaS onboarding experience:

- Telegram chat discovery exits when no chats are found, forcing a full wizard rerun after the operator messages the bot.
- Codex OAuth runs the generic browser flow and requires typing `I UNDERSTAND`; on a remote/headless VPS the Codex CLI tells the user to use `codex login --device-auth`.

The product target is a future browser/chat setup workflow. The CLI path must already behave like a smooth guided workflow, not a brittle terminal script.

## Production-Grade Acceptance Bar

The bar comes from repo conventions, field launch feedback, and current Codex CLI help for the pinned managed dependency.

Ship-ready means:

- Telegram discovery can retry in place after the operator sends a message to the bot.
- The operator can fall back to manual chat ID entry from the same flow.
- The setup wizard never requires rerunning from the top just because Telegram had no updates yet.
- Codex OAuth uses the managed Codex CLI with `login --device-auth`.
- The wizard removes all `I UNDERSTAND`-style magic confirmation phrases.
- API-key auth remains the default unattended automation path.
- OAuth remains an advanced/trusted-machine path, but its prompt is concise and actionable.
- Setup JSON remains references-only and raw secrets stay limited to the selected ignored env file or process environment.
- The implementation is covered by deterministic tests and `npm run full-rebuild`.

Forbidden shortcuts:

- Do not tell the user to rerun setup after a no-chat Telegram discovery result.
- Do not keep `I UNDERSTAND` or replace it with another magic phrase.
- Do not use plain `codex login` for the OAuth path on VPS setup.
- Do not weaken OpenClaw fail-closed behavior, managed Codex binary resolution, or references-only setup.
- Do not build a separate browser/chat UI in this revision.

## Required Behavior

### Telegram Chat Discovery

Interactive setup behavior:

- Prompt still accepts a chat ID or `discover`.
- If the user enters a chat ID, preserve existing manual behavior.
- If the user enters `discover`, call Telegram `getUpdates`.
- If chats are found, list candidates and ask which chat ID to use.
- If no chats are found:
  - print a clear instruction to send a message to the bot
  - prompt with choices that allow retry discovery or manual chat ID entry
  - do not throw and do not exit the wizard
- If Telegram API returns a real error, show the error and allow manual entry unless the token is missing/unresolvable.
- Token missing/unresolvable may still be a blocker because discovery cannot work without a bot token, but the message must be actionable.

Future workflow compatibility:

- Extract the retry/manual decision logic enough that deterministic tests can exercise it without launching a terminal subprocess.
- Do not bury all logic inside one long readline-only function.

### Codex OAuth

Interactive setup behavior:

- API key remains the default Codex auth mode.
- OAuth mode must not ask for `I UNDERSTAND`.
- OAuth mode must run the managed Codex CLI as:

```bash
codex login --device-auth
```

- The command should be invoked through the existing managed resolver, so it uses `node_modules/.bin/codex` unless an explicit override is set.
- After login, run or support `codex login status` verification when practical. If the CLI exits non-zero, fail with an actionable message.
- Store only `secret:codex-oauth-local-cache` as the setup reference; do not copy auth caches into repo, reports, backups, or setup JSON.

## Risky Seam Inventory

- Telegram provider seam: `getUpdates` may return no chats until the operator sends a message to the bot.
- Auth flow seam: Codex OAuth on remote VPS must use device auth, while API-key auth remains the unattended default.
- Secret handling seam: raw Telegram/OpenAI values must not leak into setup JSON, docs, reports, or backups.
- Future setup seam: terminal-specific prompt logic should not become impossible to reuse from browser/chat setup.

## Edge-State Matrix

Handle:

- Telegram discovery finds one or more chats.
- Telegram discovery returns no chats once, then succeeds after retry.
- Telegram discovery returns no chats repeatedly, then operator enters manual chat ID.
- Telegram token is provided as raw prompt value.
- Telegram token is provided as resolvable `env:TELEGRAM_BOT_TOKEN`.
- Telegram token is missing/unresolvable.
- Codex auth mode is API key.
- Codex auth mode is OAuth on a headless VPS.
- Managed Codex binary exists.
- Managed Codex binary is missing or override command fails.

Fail closed when:

- Telegram discovery cannot run because no token can be resolved and no manual chat ID is supplied.
- Codex OAuth command exits non-zero.
- A raw secret would be written into setup JSON.

## Implementation Targets

Exact files:

- `apps/cli/src/index.ts`
- `packages/ops/src/vps-setup.ts` if helper extraction belongs there
- `tests/vps-setup-wizard.test.ts`
- `docs/deployment/README.md`
- `docs/deployment/vps.md`
- `docs/agent-memory/CURRENT_STATE.md`
- `docs/agent-memory/TESTING.md`
- active brief reports and automation files

Likely files only if needed by a clean helper export:

- `packages/ops/src/index.ts`

## Required Tests

Add or update deterministic tests proving:

- Telegram discovery retries after an empty `getUpdates` result and then accepts discovered chat IDs without restarting setup.
- Telegram discovery can fall back to manual chat ID entry after an empty result.
- Telegram discovery does not return or persist the bot token.
- OAuth mode invokes `codex login --device-auth`, not plain `codex login`.
- The setup wizard no longer contains or prompts for `I UNDERSTAND`.
- Existing API-key setup behavior remains references-only.
- Existing OpenClaw fail-closed and managed Codex tests still pass.

## Required Proof Commands

Run and report:

```bash
npm run verify
npm run full-rebuild
```

Also run targeted proof:

```bash
npm run test -- --run tests/vps-setup-wizard.test.ts
rg -n "I UNDERSTAND|codex login(\\s|$)|--device-auth|Telegram getUpdates returned no chats|rerun setup" apps/cli/src/index.ts docs/deployment tests
```

The grep proof must show:

- no `I UNDERSTAND` prompt remains
- OAuth path uses `--device-auth`
- no user-facing setup text tells the operator to rerun the full wizard after an empty Telegram discovery

If live credentials are available, run:

```bash
npm run live:smoke
```

If live credentials are unavailable, stop as `BLOCKED_EXTERNAL` only after `npm run verify`, `npm run full-rebuild`, and the targeted setup-wizard proof pass.

## Completion Report

Write a timestamped report under `reports/`, refresh `reports/LATEST.md`, refresh `reports/LATEST.json`, update `automation/state.json` and `automation/qa.json`, commit, push, and report:

- exact Telegram retry/manual behavior implemented
- exact Codex OAuth command used
- confirmation that `I UNDERSTAND` is gone
- files changed
- tests run
- implementation commit SHA
- stop report commit SHA
- push status

## QA Gate

QA cannot accept this revision until the setup wizard can handle no-chat Telegram discovery without restart and OAuth mode uses the device-auth flow without magic confirmation phrases.
