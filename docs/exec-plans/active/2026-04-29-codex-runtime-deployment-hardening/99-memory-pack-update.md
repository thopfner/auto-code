# Memory Pack Update

Execution mode: `FINAL_SHIPGATE`
Validation level: `NO_RUNTIME_CHECK`

## Purpose

Promote durable facts from this brief into repo memory only after final QA clears the implementation.

## Candidate Facts

- Active container `CODEX_HOME` is writable and under the Compose data mount.
- OAuth source auth material is mounted separately from active runtime state.
- Runner artifacts and prompts persist under `/data/artifacts` and `/data/prompts` or their configured equivalents.
- Runner failure summaries are redacted and operator-actionable.
- Installer live-smoke behavior has an explicit hard-gate or non-fatal `BLOCKED_EXTERNAL` contract.
- A follow-up Postgres workflow/queue durability pack remains required.

## Do Not Update Early

Intermediate worker checkpoints should not update durable memory unless a later phase or fresh session needs the new runtime contract before final shipgate.
