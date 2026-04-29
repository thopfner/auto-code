# One-Command VPS Installer Worker Handoff

```text
You are implementing one authorized window in the active repo.

Target:
- Repo: /var/www/html/auto.thapi.cc
- Branch: main
- Brief: docs/exec-plans/active/2026-04-28-auto-forge-controller
- Authorization: 72-phase-5-revision-one-command-vps-installer.md only

Read for context:
- Read mode: BRIEF_REHYDRATE
- Read these files, in order:
  - AGENTS.md
  - CLAUDE.md
  - docs/agent-memory/PROJECT.md
  - docs/agent-memory/CURRENT_STATE.md
  - docs/agent-memory/TESTING.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/README.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/LATEST.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/70-one-command-vps-installer-problem-framing.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/71-one-command-vps-installer-options-and-recommendation.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/72-phase-5-revision-one-command-vps-installer.md
- Do not mention or invoke forge-bootstrap for this worker handoff.

Execute now:
- Implement only: 72-phase-5-revision-one-command-vps-installer.md
- Goal: make fresh VPS launch a one guided installer command that automates prerequisites, runtime env, setup, Docker Compose deployment, nginx/TLS, health checks, and live-smoke gating.
- Owned paths: scripts/install-vps.sh, scripts/bootstrap.sh, scripts/configure-nginx.sh, docker-compose.yml, package.json, apps/cli/src/index.ts, packages/ops/src/vps-setup.ts, packages/ops/src/index.ts, tests/vps-installer.test.ts, tests/vps-setup-wizard.test.ts, docs/deployment/**, .env.example, docs/agent-memory/CURRENT_STATE.md, docs/agent-memory/TESTING.md, docs/exec-plans/active/2026-04-28-auto-forge-controller/**
- Reuse: existing setup:vps behavior, selectTelegramChatId helper, writeEnvBlock mode-0600 behavior, FileSetupStore references-only setup persistence, managed resolveCodexCliCommand/Codex dependency, configure-nginx helper safety checks, full-rebuild/live-smoke proof gates, existing stop-report artifact pattern.
- Do not change: OpenClaw fail-closed default behavior, Telegram token secret handling, Codex API-key default, Codex OAuth device-auth behavior, setup JSON references-only policy, final live-smoke credential requirements, repo path topology, or Forge phase gates.
- Later phases are context only until a new handoff authorizes them.

Quality bar:
- Satisfy the brief's Production-grade acceptance bar.
- Do not leave known cleanup, duplicated logic, brittle seams, TODO-driven behavior, untested behavior, or immediate refactor debt unless the brief explicitly authorizes it.

Validation:
- Validation level: FULL_REBUILD
- Required proof: bash -n scripts/install-vps.sh; npm run test -- --run tests/vps-installer.test.ts tests/vps-setup-wizard.test.ts; npm run verify; npm run full-rebuild; and a dry-run installer proof showing no raw secret leakage.
- If validation cannot be made truthful inside this level, stop and report the blocker.

Stop report:
- Write a timestamped report under the active brief's reports/ folder.
- Refresh reports/LATEST.md.
- Refresh reports/LATEST.json only enough to keep it aligned with the newest stop report.
- Update automation/state.json only enough so it no longer claims stale READY_FOR_IMPLEMENTATION.
- Include a Durable memory candidates section with any facts that should be promoted to repo memory at final shipgate.
- This phase explicitly authorizes updating docs/agent-memory/CURRENT_STATE.md and docs/agent-memory/TESTING.md because the durable deployment/testing contract changes.
- Commit and push at QA_CHECKPOINT, FINAL_SHIPGATE, or blocker stop.
- Report branch, files changed, tests run, implementation_commit_sha, stop_report_commit_sha, and push status.
```

