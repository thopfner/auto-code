# Phase 1 Revision Worker Handoff

Use this for the next coding-agent run.

```text
You are working in /var/www/html/auto.thapi.cc on branch main.

Read:
1. AGENTS.md
2. CLAUDE.md
3. docs/agent-memory/PROJECT.md
4. docs/agent-memory/CURRENT_STATE.md
5. docs/agent-memory/ARCHITECTURE.md
6. docs/agent-memory/TESTING.md
7. docs/exec-plans/active/2026-04-29-openclaw-bootstrap-repo-management/README.md
8. docs/exec-plans/active/2026-04-29-openclaw-bootstrap-repo-management/reports/LATEST.md
9. docs/exec-plans/active/2026-04-29-openclaw-bootstrap-repo-management/11-phase-1-revision-telegram-ownership.md

Execute only:
docs/exec-plans/active/2026-04-29-openclaw-bootstrap-repo-management/11-phase-1-revision-telegram-ownership.md

Fix the Phase 1 Telegram ownership regression. Preserve the managed OpenClaw workspace bootstrap, but remove default same-bot OpenClaw Telegram channel provisioning from the installer path. Auto Forge must remain the sole inbound Telegram owner for the configured bot through ${PUBLIC_BASE_URL%/}/telegram/webhook.

Required validation:
bash -n scripts/install-vps.sh
bash -n scripts/setup-openclaw.sh
npm run test -- --run tests/vps-installer.test.ts tests/openclaw-bootstrap.test.ts
npm run verify
npm run full-rebuild

Stop at QA_CHECKPOINT. Write the required timestamped report under reports/, refresh LATEST.md and LATEST.json, update automation/state.json and automation/qa.json, commit, push, and report implementation_commit_sha and stop_report_commit_sha.
```

