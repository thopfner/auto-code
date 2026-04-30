# Codex Sandbox Runtime Repair - Source Ready For Target Validation

- stop_status: `READY_FOR_TARGET_VALIDATION`
- reviewed_phase: `30-phase-3-vps-telegram-proof.md`
- branch: `main`
- implementation_commit_sha: `ad77611189a953010a5d6549976a1011629c722a`
- source_candidate_commit_sha: `ad77611189a953010a5d6549976a1011629c722a`
- prior_phase_stop_report_commit_sha: `b1a136d4dbfe5b2133e6e073270e2a2d9bcb9cdd`
- target_install_path: `/opt/auto-forge-controller`
- updated_at: `2026-04-30T06:03:28Z`
- next_authorized_phase: `30-phase-3-vps-telegram-proof.md`

## Summary

This repair targets the latest product-workflow blocker where Codex returned process exit `0` while its JSONL stream contained failed `command_execution` items from bubblewrap namespace failures.

Changes:

- Compose API, worker, and smoke services now default `AUTO_FORGE_CODEX_SANDBOX=danger-full-access`.
- `setup:vps` writes `AUTO_FORGE_CODEX_SANDBOX=danger-full-access` into the runtime env.
- `CodexCliRunner` uses `AUTO_FORGE_CODEX_SANDBOX` when no explicit runner sandbox override is provided.
- `CodexCliRunner` now scans Codex JSONL for failed `item.completed` / `command_execution` events and classifies deterministic runtime failures as `blocked`, even when `codex exec` exits `0`.
- Bubblewrap namespace failures now produce an actionable blocker that names the sandbox/user-namespace issue instead of a generic runner failure.

## Validation Completed

```bash
npm run test -- --run tests/codex-runner.test.ts tests/vps-setup-wizard.test.ts tests/vps-installer.test.ts
npm run verify
docker compose config | rg -n "AUTO_FORGE_CODEX_SANDBOX|api:|worker:|smoke:" -C 2
```

Observed:

- Targeted tests passed: 40 tests.
- Full verification passed: 17 files, 114 tests.
- Compose config resolves `AUTO_FORGE_CODEX_SANDBOX: danger-full-access` for API, worker, and smoke.

## Target Validation Required

Deploy on the target checkout:

```bash
cd /opt/auto-forge-controller
git pull --ff-only
sudo bash scripts/install-vps.sh
```

Then verify the hidden command-execution failure is gone. A direct Codex container smoke should inspect JSONL, not only process exit:

```bash
docker compose exec -T api sh -lc 'mkdir -p /data/artifacts/manual-smoke && printf "%s\n" "Run pwd, then reply with exactly AUTO_FORGE_SANDBOX_SMOKE_DONE." | node_modules/.bin/codex exec --json --color never --ephemeral --sandbox danger-full-access --config approval_policy="never" --output-last-message /data/artifacts/manual-smoke/last-message.md --cd /app --skip-git-repo-check - > /data/artifacts/manual-smoke/codex-smoke.jsonl 2>&1; code=$?; echo CODEX_EXIT=$code; tail -80 /data/artifacts/manual-smoke/codex-smoke.jsonl; cat /data/artifacts/manual-smoke/last-message.md 2>/dev/null || true; exit $code'
```

Inspect `/opt/auto-forge-controller/.auto-forge/compose-data/artifacts/manual-smoke/codex-smoke.jsonl` and confirm it does not contain failed `command_execution` items with the `bwrap` namespace error.

Finally rerun the Telegram product smoke:

```text
/scope @auto-forge-controller write a README note for this repo and stop after QA
```

Expected:

- The task should no longer block due to `bwrap`.
- Worker artifacts should not contain hidden failed `command_execution` events for sandbox setup.
- Any remaining block should be a product/workflow issue surfaced directly in Telegram, not a hidden Codex runtime failure.

## Remaining Production Blockers Outside This Repair

- API workflow state still uses `MemoryWorkflowStore`; durable Postgres-backed workflow state remains a production blocker.
- Worker service still does not own durable queue consumption; real queue processing and recovery remain a production blocker.
