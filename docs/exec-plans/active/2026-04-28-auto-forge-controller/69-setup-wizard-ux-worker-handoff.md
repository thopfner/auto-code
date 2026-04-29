# Setup Wizard UX Worker Handoff

```text
You are implementing one authorized window in the active repo.

Target:
- Repo: /var/www/html/auto.thapi.cc
- Branch: main
- Brief: docs/exec-plans/active/2026-04-28-auto-forge-controller
- Authorization: 68-phase-5-revision-setup-wizard-ux-smoothing.md only

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
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/66-setup-wizard-ux-problem-framing.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/67-setup-wizard-ux-options-and-recommendation.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/68-phase-5-revision-setup-wizard-ux-smoothing.md
- Do not mention or invoke forge-bootstrap for this worker handoff.

Execute now:
- Implement only: 68-phase-5-revision-setup-wizard-ux-smoothing.md
- Goal: Smooth the setup wizard so Telegram chat discovery can retry without restarting setup, and Codex OAuth uses device auth without magic confirmation phrases.
- Owned paths: apps/cli/src/index.ts, packages/ops/src/vps-setup.ts, packages/ops/src/index.ts if needed, tests/vps-setup-wizard.test.ts, docs/deployment/**, docs/agent-memory/CURRENT_STATE.md, docs/agent-memory/TESTING.md, docs/exec-plans/active/2026-04-28-auto-forge-controller/**
- Reuse: existing discoverTelegramChatIds helper, promptSecret behavior, managed resolveCodexCliCommand helper, references-only setup persistence, existing setup wizard tests and stop-report artifact pattern.
- Do not change: OpenClaw fail-closed behavior, managed Codex binary dependency/resolution, Telegram token secret handling, setup JSON references-only policy, final live-smoke credential requirements, repo path topology, or Forge phase gates.
- Later phases are context only until a new handoff authorizes them.

Quality bar:
- Satisfy the brief's Production-grade acceptance bar.
- Do not leave known cleanup, duplicated logic, brittle seams, TODO-driven behavior, untested behavior, or immediate refactor debt unless the brief explicitly authorizes it.

Validation:
- Validation level: FULL_REBUILD
- Allowed runtime commands: npm run verify; npm run full-rebuild; npm run test -- --run tests/vps-setup-wizard.test.ts; npm run live:smoke; docker compose build; docker compose up; docker compose run; docker compose down
- Required proof: npm run verify, npm run full-rebuild, npm run test -- --run tests/vps-setup-wizard.test.ts, and grep proof for no I UNDERSTAND prompt, OAuth device-auth usage, and no rerun-setup Telegram discovery text.
- If validation cannot be made truthful inside this level, stop and report the blocker.

Stop report:
- Write a timestamped report under the active brief's reports/ folder.
- Refresh reports/LATEST.md.
- Refresh reports/LATEST.json only when present and only enough to keep it aligned with the newest stop report.
- Update automation/state.json only when present and only enough so it no longer claims stale READY_FOR_IMPLEMENTATION.
- Include a Durable memory candidates section with any facts that should be promoted to repo memory at final shipgate.
- This phase explicitly authorizes updating docs/agent-memory/CURRENT_STATE.md and docs/agent-memory/TESTING.md because the durable setup/testing contract changes.
- Commit and push at QA_CHECKPOINT, FINAL_SHIPGATE, or blocker stop unless the brief says otherwise.
- Report branch, files changed, tests run, implementation_commit_sha, stop_report_commit_sha, and push status.
```
