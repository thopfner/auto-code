# Phase 4 Target Validation And Test Repair

- updated_at: `2026-04-30T13:04:03Z`
- stop_status: `QA_CHECKPOINT_TARGET_BLOCKED`
- reviewed_phase: `40-phase-4-target-validation-and-test-repair.md`
- implementation_commit_sha: `7885835c1c73b374a9d980368e7a0f66a1d9e702`
- stop_report_commit_sha: `PENDING_REPORT_COMMIT`
- next_authorized_phase: `BLOCKED_ON_PHASE_4_QA`

## Summary

Implemented the Phase 4 OpenClaw setup test repair only.

The setup wizard should fail closed for both default OpenClaw discovery failure modes:

- OpenClaw CLI missing.
- OpenClaw CLI present but unable to report a gateway URL.

The existing hermetic missing-CLI test remains. Added a second hermetic setup command test with a temporary fake `openclaw` executable that returns gateway status JSON without a gateway URL. The command now proves the setup wizard exits non-zero and does not write setup JSON for the not-running/no-gateway-URL path.

No implementation change was needed in `packages/ops/src/openclaw-setup.ts`; the product behavior was already fail-closed.

## Files Changed

- `tests/vps-setup-wizard.test.ts`

## Verification

```bash
npx vitest run --config vitest.config.ts tests/vps-setup-wizard.test.ts
npm run verify
test -d /opt/auto-forge-controller && printf 'target_exists=yes\n' || printf 'target_exists=no\n'
```

Results:

- Focused VPS setup wizard test passed: 15 tests.
- `npm run verify` passed: lint, typecheck, schema check, and 145 tests.
- Target checkout probe returned `target_exists=no`.

## Target Validation

The Phase 4 deployed target proof could not run because `/opt/auto-forge-controller` does not exist on this host.

Not run:

```bash
cd /opt/auto-forge-controller
git rev-parse HEAD
npm install
docker compose build
docker compose up -d postgres api worker web
npm run ops:health
docker compose restart api
curl -s http://127.0.0.1:3000/workflow/tasks
```

I did not create a new target checkout or duplicate repo path because the repo operating rules prohibit creating duplicate checkouts during normal Forge execution.

## Residual Risk

- Source verification is green, but deployed target durability and `/task retry <task-id>` proof remain unverified until the real target checkout exists and has pulled the accepted commit.
- Telegram commands `/repos`, `/task status <task-id>`, `/task retry <task-id>`, and `/task logs <task-id>` were not run in this shell because the deployed target and live Telegram context are unavailable here.

## QA Checkpoint

Phase 4 is stopped for external QA with target validation blocked by missing target checkout.

## Durable Memory Candidates

- Default OpenClaw setup must fail closed for either missing CLI or a present CLI that cannot report a gateway URL, and setup JSON must not be written in either case.
