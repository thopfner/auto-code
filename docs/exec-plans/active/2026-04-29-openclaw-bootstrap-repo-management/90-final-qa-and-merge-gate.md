# Final QA And Shipgate

Execution mode: `FINAL_SHIPGATE`
Validation level: `FULL_REBUILD`

## QA Must Verify

- Phase 1 managed OpenClaw bootstrap is implemented and does not regress install/live-smoke.
- Phase 2 repo switching is implemented with path safety and active-task protections.
- Phase 3 SSH key automation is implemented without private key leakage.
- Phase 4 end-to-end proof is complete on a clean or effectively wiped test VPS.
- Setup JSON remains references-only.
- Telegram webhook ownership remains Auto Forge-owned.
- `hopfner.dev` or any other deployment hostname is not hardcoded.
- Every report contains truthful implementation and stop-report SHAs.

## Required Commands

```bash
npm run verify
npm run full-rebuild
```

Live or staged:

```bash
npm run live:smoke
```

## Final Acceptance

QA may clear only after the product can demonstrate:

- fresh install
- managed OpenClaw bootstrap
- no generic OpenClaw bootstrap prompt
- Telegram `/status`
- Telegram `/scope`
- safe repo selection
- SSH key generation/validation
- selected-repo task execution

