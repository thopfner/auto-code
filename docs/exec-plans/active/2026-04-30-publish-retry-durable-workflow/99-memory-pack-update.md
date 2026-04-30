# Memory Pack Update

Gate: final closeout only

## Goal

Promote durable facts from this brief into repo memory after final QA clears.

## Candidate Facts To Promote

- Durable workflow state behavior and any new required health proof.
- Publish-only retry behavior and safety checks.
- `/task status`, `/task retry`, and `/task logs` command contract.
- Updated target deployment validation path.
- Any changed OpenClaw setup wizard expectation.

## Files To Consider

- `docs/agent-memory/CURRENT_STATE.md`
- `docs/agent-memory/ARCHITECTURE.md`
- `docs/agent-memory/DECISIONS.md`
- `docs/agent-memory/TESTING.md`
- `docs/agent-memory/SESSION_HANDOFF.md`

## Rules

- Update only durable facts.
- Archive the accepted brief to `docs/exec-plans/completed/` at final closeout unless external QA directs otherwise.
- Do not commit unrelated dirty files.

