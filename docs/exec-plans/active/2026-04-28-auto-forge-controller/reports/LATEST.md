# Phase 5 Managed Codex CLI QA

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-29T05:45:39Z`
Stop status: `BLOCKED_EXTERNAL`

## Phase Reviewed

- `64-phase-5-revision-managed-codex-cli.md`
- Execution mode: `FINAL_SHIPGATE_REVISION`
- Validation level: `FULL_REBUILD`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Accepted implementation commit SHA: `ac13bdb34d776849f2289e05172ba7c8b7f85932`
- Worker stop report commit SHA: `7cd7eeec4b5d6290753a257fa0a6b8a5e7184eda`
- QA report commit SHA: `104139c5e127be40c64a0ba0067d369d03865e97`
- Pushed HEAD before QA report: `29e347642bae427c3f64ac5d2268976fc423d3b2`

## QA Finding

No implementation findings remain for `64-phase-5-revision-managed-codex-cli.md`.

The previously blocking fresh-VPS Codex CLI prerequisite is fixed. Codex CLI is now a repo-managed dependency through `@openai/codex@0.125.0`; runtime resolution prefers explicit runner option, then explicit `CODEX_CLI_COMMAND`, then the managed `node_modules/.bin/codex` binary. Bootstrap and Docker build both assert the managed binary exists.

Final Phase 5 clearance remains blocked only by unavailable live external credentials for OpenClaw, Telegram, and OpenAI/Codex.

## Validation Performed

```bash
npm run verify
```

Result: passed. ESLint, TypeScript, schema check, and Vitest passed: 14 files, 56 tests.

```bash
PATH=/usr/bin:/bin npm run test -- --run tests/codex-runner.test.ts
```

Result: passed. 1 file, 3 tests. The resolver found the repo-managed binary with a sanitized PATH.

```bash
PATH=/usr/bin:/bin npm run ops:health
```

Result: passed. Health reported Codex from `/var/www/html/auto.thapi.cc/node_modules/.bin/codex` with `details.source: "managed"`.

```bash
npm run full-rebuild
```

Result: passed. Completed fresh bootstrap, verify, install-check, runtime health, references-only backup/restore, recovery dry run, task/service log discovery, Docker Compose build/up/smoke, and cleanup.

Docker proof: the build included `RUN test -x node_modules/.bin/codex`; Compose smoke passed and reported Codex `codex-cli 0.125.0`.

```bash
npm run live:smoke
```

Result: `BLOCKED_EXTERNAL`.

Missing:

- `OPENCLAW_BASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_TEST_CHAT_ID`
- `OPENAI_API_KEY`

## Accepted Coverage

- `64-phase-5-revision-managed-codex-cli.md` is accepted subject to live external validation.
- `@openai/codex@0.125.0` is locked as a normal dependency in `package.json` and `package-lock.json`.
- Fresh bootstrap and Docker build assert the managed Codex binary exists.
- Runtime and health use the shared resolver.
- Sanitized-PATH runner and health proofs pass without relying on a global `codex`.
- Docs and memory no longer treat global Codex CLI as a fresh-install prerequisite.

## Residual Notes

The local `.env` in this repo still contains an older `CODEX_CLI_COMMAND=codex` value from before `.env.example` was updated. That is ignored by Git and does not block acceptance: npm-run services place `node_modules/.bin` on PATH, so the command resolves to the repo-managed binary. Fresh installs copy the updated `.env.example`, where `CODEX_CLI_COMMAND` is empty.

## Next Required Action

Provide staged or live values for:

- `OPENCLAW_BASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_TEST_CHAT_ID`
- `OPENAI_API_KEY`

Then run:

```bash
npm run setup:vps
npm run live:smoke
```

After those pass, QA can execute `90-final-qa-and-merge-gate.md`, update the memory pack through `99-memory-pack-update.md`, archive the active brief, and return `CLEAR_CURRENT_PHASE`.

## QA Status

`BLOCKED_EXTERNAL`
