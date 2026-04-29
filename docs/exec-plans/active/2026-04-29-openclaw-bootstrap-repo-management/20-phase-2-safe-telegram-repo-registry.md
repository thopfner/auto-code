# Phase 2 - Safe Telegram Repo Registry

Execution mode: `QA_CHECKPOINT`
Validation level: `FULL_REBUILD`
Authorization status: authorized after Phase 1 QA clearance on 2026-04-29

## Goal

Let the operator change active VPS repo folders and Git repos from Telegram in a clean, safe, auditable way.

## Why This Is A Later Phase

Repo switching changes task routing and mutation boundaries. It must not be bundled with the OpenClaw bootstrap fix because it touches authorization, path safety, repo locks, and task execution.

## Expected Commands

Design and implement commands close to:

```text
/repos
/repo
/repo use <alias>
/repo add-path <alias> <absolute-path>
/repo clone <alias> <git-url>
/repo pause <alias>
/repo resume <alias>
/scope @<alias> <task>
```

Exact command naming may change if it fits the existing Telegram parser better, but the UX must stay concise.

## Required Safety Model

- Only registered repos can be selected.
- Repo paths must live under an allowed root such as `/opt/auto-forge-repos`.
- Resolve realpaths and reject symlink escape.
- Reject paths outside allowed roots.
- Reject non-git directories unless the command is explicitly a clone/register flow.
- Block active repo switching while a mutating task is running for the current repo.
- Preserve per-repo locks.
- Audit every repo add/use/pause/resume event.
- `/scope` uses the active repo unless an explicit repo alias is supplied.

## Expected Code Surfaces

Likely:

- `apps/api/src/server.ts`
- `packages/core/src/types.ts`
- `packages/core/src/workflow-store.ts`
- `packages/core/src/workflow-engine.ts`
- `migrations/**` if durable repo active-selection state is added
- `tests/telegram-workflow-api.test.ts`
- new repo registry/path safety tests
- docs/deployment/operator docs

## Required Proof

- Telegram command tests for repo list/use/add-path/clone/pause/resume.
- Path traversal and symlink escape rejection tests.
- Active task lock rejection tests.
- `/scope` creates tasks against the selected repo.
- Setup remains references-only.
- `npm run verify`
- `npm run full-rebuild`

## Stop Gate

Stop at `QA_CHECKPOINT`. Do not start SSH key automation until QA clears repo switching.
