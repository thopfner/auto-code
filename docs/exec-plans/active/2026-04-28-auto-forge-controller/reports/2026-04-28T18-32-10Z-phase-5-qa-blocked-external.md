# Phase 5 QA Checkpoint

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-28T18:32:10Z`
Stop status: `BLOCKED_EXTERNAL`

## Phase Reviewed

- `50-phase-5-e2e-hardening.md`
- Execution mode: `FINAL_SHIPGATE`
- Validation level: `FULL_REBUILD`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Implementation commit SHA: `8fdd6aba6e7adfe8277283aa89e3750f86c479ba`
- Previous pushed metadata HEAD: `f14b12304d6fc767dbbfa89fed4da73c1dab9ed5`
- QA report commit SHA: `PENDING_QA_REPORT_COMMIT`
- Push status: QA artifacts will be pushed after metadata stamping.

## QA Finding

Phase 5 cannot be cleared because the final shipgate requires a live or staged Telegram/OpenClaw smoke and a real authenticated Codex runner smoke. The local environment does not currently provide the required external credentials.

Missing credentials reported by `npm run live:smoke`:

- `OPENCLAW_BASE_URL`
- `OPENCLAW_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_TEST_CHAT_ID`
- `OPENAI_API_KEY`

Finding type: `validation_only` / `external_credentials_missing`.

## Independent QA Verification

```bash
runuser -u tyler -- npm run verify
```

Result: passed. ESLint, TypeScript, schema check, and Vitest all passed: 13 test files, 44 tests.

```bash
runuser -u tyler -- npm run full-rebuild
```

Result: passed. Completed bootstrap, verify, install-check, health, references-only backup and restore dry run, recovery dry run, task and service log discovery, Docker Compose build/up/smoke, and Docker Compose cleanup.

```bash
runuser -u tyler -- npm run live:smoke
```

Result: `BLOCKED_EXTERNAL` due the missing external credentials listed above.

```bash
runuser -u tyler -- npx tsx -e '<validateForgeArtifacts invocation>'
```

Result: passed. Machine-readable artifacts are valid, use full 40-character SHAs, branch is `main`, and the branch is pushed.

```bash
runuser -u tyler -- docker compose ps --all
```

Result: no Compose services remain after cleanup.

## Coverage Accepted So Far

- Fresh install path is covered by `scripts/bootstrap.sh` inside `npm run full-rebuild`.
- Onboarding, Telegram `/scope`, clarification resume, planning approval resume, worker execution, QA revision loop, final completion, operator summaries, and pushed fixture repo artifact validation are covered by `tests/e2e-hardening.test.ts`.
- Docker Compose or production-equivalent rebuild proof passed through `npm run full-rebuild`.
- Live/staged Telegram/OpenClaw/Codex proof remains blocked by missing external credentials.

## Required Unblock

Export the required staged or live credentials and rerun:

```bash
npm run live:smoke
```

Final QA must remain stopped until that live smoke passes. After it passes, QA can complete `90-final-qa-and-merge-gate.md`, update the memory pack through `99-memory-pack-update.md`, archive the active brief, and then consider `CLEAR_CURRENT_PHASE`.

## QA Status

`BLOCKED_EXTERNAL`
