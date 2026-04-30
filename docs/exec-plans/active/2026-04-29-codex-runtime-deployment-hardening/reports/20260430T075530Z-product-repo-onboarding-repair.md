# Product Repo Onboarding Repair

- brief_id: `2026-04-29-codex-runtime-deployment-hardening`
- updated_at: `2026-04-30T07:55:30Z`
- stop_status: `READY_FOR_TARGET_VALIDATION`
- source_candidate_commit_sha: `72af3fae6ae9f4913983bcc0c9ffe8fedda4603c`
- prior_phase_stop_report_commit_sha: `919ba404e086f7cb7129bd1c35a278a1c37b10e6`
- implementation_commit_sha: `72af3fae6ae9f4913983bcc0c9ffe8fedda4603c`
- next_authorized_phase: `30-phase-3-vps-telegram-proof.md`

## Summary

Corrected the Telegram repo workflow so the deployed Auto Forge Controller checkout is treated as the system harness, not the implicit product work target.

Changes:

- `/repos` now labels the deployed controller checkout as `system/controller`.
- `/scope` without a selected product repo now blocks with product-repo onboarding instructions instead of silently targeting the controller checkout.
- `/repo use auto-forge-controller` is refused as the default product target, preventing accidental self-editing.
- `/repo clone <alias> <git-url> [absolute-project-path]` now supports an operator-defined VPS project folder under configured allowed roots.
- Telegram command descriptions now frame `/scope`, `/repos`, and `/repo` around selected product repos.
- Durable memory and testing memory now record the controller-vs-product-repo topology rule.

## Verification

Source/dev checkout validation passed:

```bash
npm test -- tests/telegram-workflow-api.test.ts
npm run verify
```

`npm run verify` passed lint, TypeScript, schema check, and Vitest with 17 test files and 123 tests.

## Target Follow-Up

Pull `72af3fae6ae9f4913983bcc0c9ffe8fedda4603c` into `/opt/auto-forge-controller`, rerun the installer or recreate the services, then use the intended Telegram workflow:

```text
/repos
/repo clone auto-coder https://github.com/<owner>/<repo>.git /data/repos/auto-coder
/repo use auto-coder
/repo github-setup auto-coder
/repo key create auto-coder
```

After adding the shown deploy key to that GitHub repo with write access:

```text
/repo git-test auto-coder
/scope @auto-coder define the initial project framing and bootstrap the repo memory/plan/QA workflow
```
