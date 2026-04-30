# Product QA Artifact Outcome Repair

- brief_id: `2026-04-29-codex-runtime-deployment-hardening`
- updated_at: `2026-04-30T09:49:26Z`
- stop_status: `READY_FOR_TARGET_VALIDATION`
- source_candidate_commit_sha: `d2dfdbd9e0bbd931096cd39346471cb729eaed5a`
- prior_phase_stop_report_commit_sha: `c379a2d01e926a32fb756d92c8e68dda05639fa2`
- implementation_commit_sha: `d2dfdbd9e0bbd931096cd39346471cb729eaed5a`
- next_authorized_phase: `30-phase-3-vps-telegram-proof.md`

## Summary

Fixed the controller-side QA outcome path that could block a product task with stale controller-repo QA state even when product QA passed.

Changes:

- Relative active brief paths now resolve under the target product repo path for artifact validation.
- Stale controller-repo `automation/qa.json` no longer controls product repo task outcomes.
- Validator can classify fallback `automation/qa-checkpoint.json` with nested `qa.status: passed`.
- Local QA pass plus push/auth publishing risk is reported as an external push-pending blocker, not as generic product QA failure.
- QA prompts now explicitly require canonical `reports/LATEST.md`, `reports/LATEST.json`, `automation/state.json`, and `automation/qa.json` with top-level QA/push fields.

## Verification

Source/dev checkout validation passed:

```bash
npm test -- tests/artifact-validation.test.ts tests/workflow-engine.test.ts
npm run verify
```

`npm run verify` passed lint, TypeScript, schema check, and Vitest with 17 test files and 127 tests.

## Target Follow-Up

Pull `d2dfdbd9e0bbd931096cd39346471cb729eaed5a` into `/opt/auto-forge-controller`, rerun the installer or recreate services, then retry the product task:

```text
/scope @coder-frontend <same scope text>
```

Expected behavior if local QA passes but GitHub push remains unauthenticated:

```text
Blocked: local QA passed, but GitHub push failed or is pending...
```

It should not return only:

```text
Blocked: QA blocked the task.
```
