# Final QA And Closeout Gate

## Automated Checks

Final QA must run the full documented suite created during implementation.

## Manual QA

Final QA must verify:

- fresh clone bootstrap
- web onboarding
- OpenClaw gateway connection
- Telegram command path
- Codex runner path
- repo registration
- complete Forge lifecycle
- recovery/status commands

## Required Runtime Validation Proof

Use `FULL_REBUILD` because deployment, worker, service, and runtime wiring must be truthful.

## Required Test Additions

The final suite must include fake-adapter deterministic tests and at least one real integration smoke path for OpenClaw/Codex when credentials are available.

## Completion Report Required

The coding agent must write a final report under `reports/`, refresh `reports/LATEST.md`, update machine-readable artifacts, commit, and push.

## Explicit Non-Goals

- No merge-to-main or PR action unless the user explicitly asks.
- No unrelated repo cleanup.

## QA Stop Status Options

- `CLEAR_CURRENT_PHASE`
- `REVISION_PACK_REQUIRED`
- `REPLAN_REQUIRED`
- `BLOCKED_EXTERNAL`

