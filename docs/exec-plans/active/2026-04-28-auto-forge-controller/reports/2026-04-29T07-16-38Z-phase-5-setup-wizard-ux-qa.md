# Phase 5 Setup Wizard UX QA

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-29T07:16:38Z`
Stop status: `BLOCKED_EXTERNAL`

## Phase Reviewed

- `68-phase-5-revision-setup-wizard-ux-smoothing.md`
- Execution mode: `FINAL_SHIPGATE_REVISION`
- Validation level: `FULL_REBUILD`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Implementation commit SHA: `7e7c4c5e38392c6721266effbf0c1eb246a7fee4`
- Worker report commit SHA: `858db6df11c521aed09d845c8eaafb973eadf8ee`
- Worker pushed HEAD before QA: `1825390c65008eed8d3c896fad3c45aae70c3de8`
- QA report commit SHA: `PENDING_QA_REPORT_COMMIT`

## Findings

No implementation findings.

The revision satisfies the setup wizard UX brief:

- Telegram chat discovery now retries in place after an empty `getUpdates` result.
- The same wizard step can fall back to manual Telegram chat ID entry.
- Telegram discovery does not return or persist the raw bot token.
- Codex OAuth runs the managed Codex CLI with `login --device-auth`, then verifies `login status`.
- The setup wizard no longer contains the `I UNDERSTAND` magic confirmation phrase.
- API-key Codex auth remains the default unattended path.
- Setup JSON and backup/restore behavior remain references-only.

## QA-Owned Artifact Repair

The worker created valid implementation and report commits, then added later report-only push-status commits. QA re-anchored the newest authoritative stop state to this QA report so `reports/LATEST.md`, `reports/LATEST.json`, and `automation/*.json` point at the current reviewed state rather than the older worker stop report.

## Verification Run By QA

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

```bash
npm run live:smoke
```

Result: `BLOCKED_EXTERNAL`.

Missing:

- `OPENCLAW_BASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_TEST_CHAT_ID`
- `OPENAI_API_KEY`

## Next Authorized Window

- `90-final-qa-and-merge-gate.md`
- Status remains `BLOCKED_EXTERNAL` until staged or live OpenClaw, Telegram, and OpenAI credentials are available and `npm run live:smoke` passes.

## Durable Memory Candidates

- The VPS setup wizard can retry Telegram `getUpdates` in place and fall back to manual chat ID entry without restarting setup.
- Codex OAuth/manual setup uses the repo-managed Codex CLI with `login --device-auth` and `login status`; API-key auth remains the default unattended path.
- The setup wizard no longer uses magic confirmation phrases for Codex OAuth.

## QA Status

`BLOCKED_EXTERNAL`
