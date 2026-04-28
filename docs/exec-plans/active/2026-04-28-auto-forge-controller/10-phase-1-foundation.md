# Phase 1 - Foundation

Execution mode: `QA_CHECKPOINT`
Validation level: `NO_RUNTIME_CHECK`

## Goal

Create the production project foundation: stack choice, service skeleton, state model, runner abstraction, configuration contract, and first tests.

## Owned Files Or Modules

- Project package/config files.
- Source skeleton for controller API, worker, web app, CLI, and shared types.
- DB schema/migration setup.
- Runner abstraction and fake runner.
- Initial docs and env examples.

## Files To Change, In Order

Exact files are not yet fixed because the implementation stack must be chosen in this phase. Start by documenting the chosen stack and then create the minimum skeleton needed to prove it.

## Required Stack Decision

Choose a stack that supports:

- web onboarding UI
- server-side OpenClaw/Codex orchestration
- durable DB migrations
- background workers
- testable adapters
- Docker Compose deployment

Bias toward TypeScript/Node because OpenClaw and Codex SDK integration are likely strongest there, but stop and justify if another stack is better after live verification.

## Step-By-Step Implementation

1. Verify available local tooling.
2. Decide stack and record the decision in `docs/agent-memory/DECISIONS.md`.
3. Create service skeleton for web/API/worker/CLI.
4. Define task state machine types.
5. Define repo, user, runner profile, approval, run attempt, artifact, and lock models.
6. Add migrations or schema generation.
7. Implement fake runner adapter and fake OpenClaw/Telegram adapter.
8. Add unit tests for core state transitions.
9. Add lint/type/test commands and update `docs/agent-memory/TESTING.md`.

## Required Behavior

- A task can be created, queued, moved to waiting approval, resumed, blocked, cancelled, and completed in tests.
- Repo locks prevent two mutating task windows for the same repo.
- Runner interface can represent scope, planner/QA, and worker roles.
- Secrets are represented by references or env keys, not committed values.

## What Must Not Change

- Do not implement the full UI before the state model exists.
- Do not depend on real Telegram/OpenClaw/Codex for unit tests.
- Do not create duplicate repo checkouts.

## Required Runtime Evidence

No live runtime check required in Phase 1, but local tests must run.

## Required Tests

- State transition unit tests.
- Repo lock unit tests.
- Fake runner lifecycle tests.
- Config validation tests.

## Required Durable Memory Updates

- Update `DECISIONS.md` with stack choice.
- Update `TESTING.md` with exact commands.
- Update `CURRENT_STATE.md` with Phase 1 completion state.

## Gate For Moving Forward

Stop after Phase 1 and wait for QA clearance before starting Phase 2.

