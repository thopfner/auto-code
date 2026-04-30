# Phase 3 Task Command UX And Recovery

- updated_at: `2026-04-30T11:31:21Z`
- stop_status: `QA_CHECKPOINT`
- reviewed_phase: `30-phase-3-task-command-ux-and-recovery.md`
- implementation_commit_sha: `da2187629ff574c6c570517ffaf7db7d3f669d6e`
- stop_report_commit_sha: `773585166e042f24e17435fa3b7100f9ae4cee71`
- next_authorized_phase: `BLOCKED_ON_PHASE_3_QA`

## Summary

Implemented Phase 3 only.

- Added `/task status <task-id>` with repo alias, task status, blocker kind, latest event names, and next action.
- Added `/task logs <task-id>` with run log paths, artifact paths, and recovery log locations without returning log contents.
- Added API `GET /workflow/tasks/:taskId/status` and `GET /workflow/tasks/:taskId/logs`.
- Extended `/workflow/tasks/:taskId/recover` with explicit retry actions:
  - `{ "action": "retry", "mode": "publish" }`
  - `{ "action": "retry", "mode": "from-blocker" }`
- Made automatic retry fail closed unless the task is safely classified as a publish-only retry after clear QA.

## Verification

```bash
npx vitest run --config vitest.config.ts tests/telegram-workflow-api.test.ts tests/workflow-engine.test.ts
npm run verify
```

Results:

- Focused workflow/API tests passed: 42 tests.
- `npm run verify` passed: lint, typecheck, schema check, and 144 tests.

## Confirmed Behavior

- `/task status` returns concise Telegram-safe task state and operator choices.
- `/task logs` returns paths only and does not dump log content or secrets through Telegram.
- Recovery retry mode `from-blocker` reruns the task from scope through QA after explicit operator choice.
- Recovery retry mode `publish` is refused for unsupported blockers with concrete alternatives.
- Ambiguous `/task retry <task-id>` is refused with explicit `publish` and `from-blocker` choices.
- Existing publish-only retry still avoids runner dispatch when canonical clear-QA artifacts prove a failed push.

## QA Checkpoint

Phase 3 is stopped at `QA_CHECKPOINT` for external review. Phase 4 is not authorized until QA clears this checkpoint.

## Durable Memory Candidates

- Task recovery retry must be mode-explicit for ambiguous blockers. Automatic retry may only proceed when the controller can prove a publish-only retry after clear QA; otherwise it must fail closed with `/task retry <task-id> publish <reason>` and `/task retry <task-id> from-blocker <reason>` choices.
- Task log/status Telegram commands return summaries and paths only. They must not stream raw logs, private keys, tokens, or auth cache paths through Telegram.
