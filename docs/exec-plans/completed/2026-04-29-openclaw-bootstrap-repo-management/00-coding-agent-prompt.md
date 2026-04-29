# Coding Agent Prompt

You are working in `/var/www/html/auto.thapi.cc` on branch `main`.

Read:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/agent-memory/PROJECT.md`
4. `docs/agent-memory/CURRENT_STATE.md`
5. `docs/agent-memory/ARCHITECTURE.md`
6. `docs/agent-memory/DECISIONS.md`
7. `docs/agent-memory/TESTING.md`
8. `docs/exec-plans/active/2026-04-29-openclaw-bootstrap-repo-management/README.md`
9. `docs/exec-plans/active/2026-04-29-openclaw-bootstrap-repo-management/01-brief-lineage-and-sources.md`
10. `docs/exec-plans/active/2026-04-29-openclaw-bootstrap-repo-management/03-root-cause-or-audit.md`
11. `docs/exec-plans/active/2026-04-29-openclaw-bootstrap-repo-management/10-phase-1-managed-openclaw-bootstrap.md`

Execute only:

- `docs/exec-plans/active/2026-04-29-openclaw-bootstrap-repo-management/10-phase-1-managed-openclaw-bootstrap.md`

Do not execute Phase 2, Phase 3, Phase 4, or final shipgate work yet.

Fix the OpenClaw default-programming/bootstrap problem by adding a separate managed OpenClaw bootstrap script, called by the VPS installer, that creates the core OpenClaw workspace markdown files and initial settings from the outset.

Required validation:

```bash
bash -n scripts/install-vps.sh
npm run test -- --run tests/vps-installer.test.ts
npm run verify
npm run full-rebuild
```

Add any new targeted test files needed for the managed OpenClaw bootstrap code and include them in the stop report.

Stop at `QA_CHECKPOINT`. Write the required timestamped report under this brief's `reports/`, refresh `LATEST.md` and `LATEST.json`, update `automation/state.json` and `automation/qa.json`, commit, push, and report `implementation_commit_sha` and `stop_report_commit_sha`.

