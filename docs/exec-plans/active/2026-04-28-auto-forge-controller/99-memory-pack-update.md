# Memory Pack Update

## Files To Update

At final shipgate, QA must update:

- `docs/agent-memory/CURRENT_STATE.md`
- `docs/agent-memory/SESSION_HANDOFF.md`
- `docs/agent-memory/TESTING.md` if commands changed
- `docs/agent-memory/DECISIONS.md` if durable decisions changed
- `docs/agent-memory/ARCHITECTURE.md` if implemented architecture differs from this plan
- `docs/ui/*` if frontend conventions changed

## Exact Facts To Record

- Implemented stack.
- Deployment commands.
- Verification commands.
- Known operational limits.
- Supported auth modes.
- Final go-live evidence.

## Active-To-Completed Brief Move Rules

After final acceptance, move this brief from `docs/exec-plans/active/2026-04-28-auto-forge-controller/` to `docs/exec-plans/completed/2026-04-28-auto-forge-controller/` and verify the archived path.

## Stop Condition If Memory Would Become Misleading

Do not return `CLEAR_CURRENT_PHASE` if durable memory cannot be updated truthfully.

