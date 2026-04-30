# Phase 4: Target Validation And Test Repair

Gate: `QA_CHECKPOINT`  
Validation level: `FULL_REBUILD`  
Authorization: context only until Phase 3 clears

## Goal

Close the stale OpenClaw setup test expectation and prove the full target flow on the deployed checkout.

## Owned Paths

- `tests/vps-setup-wizard.test.ts`
- `packages/ops/src/openclaw-setup.ts` only if behavior is wrong rather than the test
- `docs/agent-memory/TESTING.md` only if verification commands change
- this brief's `reports/**` and `automation/**`

## Required Implementation

- Decide whether the failing OpenClaw setup wizard test should expect missing CLI only, not-running gateway, or either fail-closed condition.
- Update test or implementation intentionally, with a note in the stop report.
- Run full source verification.
- Pull the accepted commit into `/opt/auto-forge-controller`.
- Run target Compose service proof.
- Confirm `/workflow/tasks` persists across API restart.
- Confirm a publish-blocked task can be completed by `/task retry <task-id>` after GitHub credentials/deploy key are configured.

## Required Proof

Source:

```bash
npm run verify
```

Target:

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

Telegram:

```text
/repos
/task status <task-id>
/task retry <task-id>
/task logs <task-id>
```

## Stop Gate

Stop for external QA after committing and pushing Phase 4.

