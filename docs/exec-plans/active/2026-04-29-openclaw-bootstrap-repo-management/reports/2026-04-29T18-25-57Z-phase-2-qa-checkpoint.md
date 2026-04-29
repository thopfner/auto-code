# Phase 2 QA Checkpoint - Safe Telegram Repo Registry

- stop_status: `QA_CHECKPOINT`
- phase: `20-phase-2-safe-telegram-repo-registry.md`
- implementation_commit_sha: `301bad5b52a34726f6d626d577282a4f335e8a84`
- stop_report_commit_sha: `PENDING_STOP_REPORT_COMMIT`

## Files Changed

- `apps/api/src/server.ts`
- `packages/core/src/setup.ts`
- `packages/core/src/types.ts`
- `packages/core/src/workflow-engine.ts`
- `packages/core/src/workflow-store.ts`
- `tests/telegram-workflow-api.test.ts`
- `docs/deployment/README.md`

## Implemented Behavior

- Added Telegram repo commands: `/repos`, `/repo`, `/repo use <alias>`, `/repo add-path <alias> <absolute-path>`, `/repo clone <alias> <git-url>`, `/repo pause <alias>`, and `/repo resume <alias>`.
- Added `/scope @<alias> <task>` explicit repo targeting while preserving `/scope <task>` against the operator's active repo.
- Added repo alias lookup, active repo selection per Telegram operator, repo listing, pause/resume state, and repo registry audit events.
- Added path safety for registered paths and clone targets: absolute paths only, realpath resolution, allowed-root containment, symlink escape rejection, and git work-tree validation.
- Added clone support through `git clone` into `AUTO_FORGE_ALLOWED_REPO_ROOTS` with `https://`, `ssh://`, `git@`, or `file://` URLs.
- Blocked active repo switching while the current repo has a mutating `worker_running` or `qa_running` task.
- Blocked new `/scope` tasks for paused repos.

## Preserved Behavior

- Phase 1 managed OpenClaw bootstrap files and installer behavior were not changed.
- Auto Forge remains the Telegram webhook owner for the configured bot.
- No SSH key automation, deploy-key creation, or GitHub deploy-key API integration was started.
- Setup JSON remains references-only; no raw Telegram, OpenClaw, Codex, SSH, or Git credentials were added to setup responses.

## Validation Run

- `npm run test -- --run tests/telegram-workflow-api.test.ts`: passed, 1 file / 13 tests
- `npm run verify`: passed, lint/typecheck/schema check and 16 files / 96 tests
- `npm run full-rebuild`: passed, including fresh bootstrap, verify, install-check, health, backup/restore, recovery/log discovery, Docker Compose build/up/smoke, and cleanup

## Dirty Repo Note

An unrelated untracked `tools/forge/__pycache__/` directory existed before this work and was left unmodified and uncommitted.

## Durable Memory Candidates

- Telegram repo registration now enforces allowed-root realpath containment and rejects symlink escapes before a repo can become selectable.
- Telegram `/scope` uses the operator's active registered repo unless an explicit `@alias` is supplied.
- Repo switching is blocked while the current repo has a mutating worker or QA task.
- Phase 3 GitHub SSH key automation remains unstarted until Phase 2 QA clearance.

## QA Gate

Stop here at `QA_CHECKPOINT`. Do not start Phase 3 SSH key automation until QA clears Phase 2.
