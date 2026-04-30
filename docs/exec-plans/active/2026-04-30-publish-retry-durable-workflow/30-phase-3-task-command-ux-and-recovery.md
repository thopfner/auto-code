# Phase 3: Task Command UX And Recovery

Gate: `QA_CHECKPOINT`  
Validation level: `SERVICE_RESTART`  
Authorization: authorized after Phase 2 revision QA clearance

## Goal

Expose task recovery as a usable Telegram/API workflow instead of requiring raw API knowledge or repeated `/scope` commands.

## Owned Paths

- `apps/api/src/server.ts`
- `apps/cli/src/index.ts` if CLI recovery actions need parity
- `packages/ops/src/recovery.ts`
- `packages/core/src/setup.ts`
- `tests/telegram-workflow-api.test.ts`
- `tests/ops.test.ts`

## Required Implementation

- Add `/task status <task-id>` with repo alias, task status, blocker kind when available, latest events summary, and next action.
- Add `/task logs <task-id>` returning task log/artifact locations without dumping secrets.
- Extend `/workflow/tasks/:taskId/recover` with:
  - `{ "action": "retry", "mode": "publish" }`
  - `{ "action": "retry", "mode": "from-blocker" }`
- Make ambiguous automatic retry fail closed with specific operator choices.
- Update Telegram command catalog for `/task`.
- Keep command output concise enough for Telegram.

## Do Not Change

- Do not expose private SSH keys, tokens, raw auth cache paths, or long logs in Telegram.
- Do not add a web dashboard in this phase.

## Required Proof

Run:

```bash
npm run verify
```

Tests must cover `/task status`, `/task logs`, retry mode validation, and unsupported blocker refusal.

## Stop Gate

Stop for external QA after committing and pushing Phase 3.
