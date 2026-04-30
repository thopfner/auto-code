# Phase 4 QA Target Blocked

- updated_at: `2026-04-30T13:08:57Z`
- qa_status: `BLOCKED_EXTERNAL`
- reviewed_phase: `40-phase-4-target-validation-and-test-repair.md`
- implementation_commit_sha: `7885835c1c73b374a9d980368e7a0f66a1d9e702`
- stop_report_commit_sha: `PENDING_COMMIT`
- next_authorized_phase: `BLOCKED_ON_TARGET_CHECKOUT`

## Findings

### P0: Target deployment proof is blocked by missing target checkout

Classification: `validation_only`, external topology blocker.

Phase 4 explicitly requires target validation from `/opt/auto-forge-controller`, including Compose startup, `ops:health`, API restart persistence, and Telegram task command checks. The target checkout is absent on this host:

```bash
test -d /opt/auto-forge-controller && printf 'target_exists=yes\n' || printf 'target_exists=no\n'
```

Result:

```text
target_exists=no
```

I did not create `/opt/auto-forge-controller` because the repo operating rules prohibit creating duplicate checkouts during normal Forge execution. Source implementation can be reviewed, but Phase 4 cannot clear until the real deployment checkout exists and pulls the accepted commit.

## Source Review

No source implementation blocker was found in the Phase 4 test repair.

The source change is scoped to `tests/vps-setup-wizard.test.ts`. It adds hermetic coverage for the OpenClaw CLI-present-but-no-gateway-URL path and verifies setup fails closed without writing setup JSON. This matches the Phase 4 requirement to decide whether missing CLI, not-running gateway, or either condition should be accepted as a fail-closed setup outcome.

## Verification

```bash
npx vitest run --config vitest.config.ts tests/vps-setup-wizard.test.ts
npm run verify
test -d /opt/auto-forge-controller && printf 'target_exists=yes\n' || printf 'target_exists=no\n'
```

Results:

- Focused VPS setup wizard test: passed, 15 tests.
- `npm run verify`: passed; lint, typecheck, schema check, and 145 tests passed.
- Target checkout probe: `target_exists=no`.

## Required Next Action

Restore or provide the real deployment checkout at `/opt/auto-forge-controller`, pull the accepted source commit, then rerun the Phase 4 target validation commands from `40-phase-4-target-validation-and-test-repair.md`.

Do not rerun the source implementation unless the target validation exposes a runtime issue.

## Durable Memory Candidates

- Default OpenClaw setup must fail closed for either missing CLI or a present CLI that cannot report a gateway URL, and setup JSON must not be written in either case.
