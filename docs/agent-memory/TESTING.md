# Auto Forge Controller Testing Memory

Last refreshed: 2026-04-28

## Fast Checks

- Before implementation stack exists: `git status --short` and `rg --files`.
- After implementation stack exists, Phase 1 must define exact lint, typecheck, unit, migration, and smoke commands.

## Full Verification

The final product must provide a single documented verification command or script that runs:

- formatting or lint checks
- type checks
- unit tests
- integration tests for controller state transitions
- OpenClaw webhook contract tests
- Codex runner adapter smoke tests with a fake runner and at least one real local smoke path
- web onboarding UI tests
- Docker Compose or deployment smoke checks

## Runtime QA

Final shipgate must prove:

- fresh local install
- fresh VPS-style install
- OpenClaw gateway health
- Telegram command registration or documented BotFather setup
- `/scope` intake from Telegram
- scope clarification pause and resume
- planning approval pause and resume
- worker execution to QA stop
- QA revision or clearance path
- final closeout archive and memory update

## Test Data And Fixtures

- Use a disposable fixture repo for end-to-end tests.
- Use fake Telegram/OpenClaw/Codex adapters for deterministic CI.
- Use one real OpenClaw/Codex smoke run before declaring go-live readiness.

## Known Gaps

- No implementation commands exist yet.

