# Phase 3 - Codex Runner And Forge Engine

Execution mode: `QA_CHECKPOINT`
Validation level: `SERVICE_RESTART`

## Goal

Implement the real Forge workflow engine: scope, plan, worker, QA, revision/replan loop, artifact watcher, and Telegram approval loop.

## Owned Modules

- Codex runner adapter.
- Forge prompt builder.
- Workflow state machine.
- Artifact watcher.
- Telegram approval/resume handling.
- Repo git-state verifier.

## Required Behavior

- `/scope` creates a task and starts a scope run.
- Clarification questions pause and resume through Telegram.
- Planning approval pauses and resumes through Telegram.
- Planner handoff starts worker execution.
- Worker stop artifacts trigger QA.
- QA outcomes route to next worker handoff, revision pack, replan, blocker, or closeout.
- Artifact watcher verifies `reports/LATEST.md`, `reports/LATEST.json`, `automation/state.json`, `automation/qa.json`, branch, full SHAs, and push status when present.

## Required Tests

- Fake end-to-end workflow tests covering success, clarification, approval, revision, blocked, cancel, and retry.
- Codex adapter smoke test.
- Git artifact validation tests.

## Gate

Stop for QA after a fake full workflow and one real Codex smoke path pass.

