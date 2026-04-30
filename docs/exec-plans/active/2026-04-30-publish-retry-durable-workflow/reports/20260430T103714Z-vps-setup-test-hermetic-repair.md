# VPS Setup Test Hermetic Repair

- updated_at: `2026-04-30T10:37:14Z`
- stop_status: `VERIFY_REPAIR_COMPLETE`
- implementation_commit_sha: `68e40ce5b470bc86437874301c19c08c1b9c32b6`
- stop_report_commit_sha: `68e40ce5b470bc86437874301c19c08c1b9c32b6`
- next_authorized_phase: `10-phase-1-durable-store-health-proof.md`

## Summary

`npm run verify` was green in the source checkout, but the known VPS failure mode was environment-sensitive: the default OpenClaw discovery test expected a missing CLI message, while a VPS with `openclaw` installed but no running gateway can fail closed with a gateway-not-discoverable message instead.

The test now forces a missing OpenClaw command through `OPENCLAW_CLI_COMMAND` inside a temporary path. This keeps the test hermetic and prevents host-installed OpenClaw from changing the expected failure mode.

## Files Changed

- `tests/vps-setup-wizard.test.ts`

## Verification

```bash
npm run test -- tests/vps-setup-wizard.test.ts
npm run verify
```

Results:

- `tests/vps-setup-wizard.test.ts`: 14 tests passed.
- `npm run verify`: lint, typecheck, schema check, and 130 tests passed.

## Durable Memory Candidates

- VPS setup wizard tests that validate missing OpenClaw CLI behavior should force the CLI command path instead of depending on host `PATH`, because deployment hosts may already have OpenClaw installed without a running gateway.
