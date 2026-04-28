# OpenClaw Fail-Closed Worker Handoff

```text
You are implementing one authorized revision window in the active repo.

Target:
- Repo: /var/www/html/auto.thapi.cc
- Branch: main
- Brief: docs/exec-plans/active/2026-04-28-auto-forge-controller
- Authorization: 61-phase-5-revision-openclaw-fail-closed.md only

Read for context:
- Read mode: BRIEF_REHYDRATE
- Read these files, in order:
  - AGENTS.md
  - CLAUDE.md
  - docs/agent-memory/PROJECT.md
  - docs/agent-memory/ARCHITECTURE.md
  - docs/agent-memory/CURRENT_STATE.md
  - docs/agent-memory/TESTING.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/README.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/59-phase-5-revision-openclaw-bootstrap.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/LATEST.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/61-phase-5-revision-openclaw-fail-closed.md
- Do not mention or invoke forge-bootstrap for this worker handoff.

Execute now:
- Implement only: 61-phase-5-revision-openclaw-fail-closed.md
- Goal: default OpenClaw detection must fail closed when gateway discovery fails, while configure-later remains an explicit incomplete setup path.
- Owned paths: apps/cli/src/index.ts, packages/ops/src/openclaw-setup.ts, packages/ops/src/vps-setup.ts, tests/vps-setup-wizard.test.ts, docs/deployment/** if command behavior changes, docs/exec-plans/active/2026-04-28-auto-forge-controller/**
- Reuse: existing OpenClaw setup modes, `discoverOpenClawGateway`, references-only setup persistence, and current setup wizard tests.
- Do not change: Telegram/OpenAI credential requirements, advanced webhook optional mode, global /opt/forge-skills, repo path, or branch topology.
- Later phases are context only until a new handoff authorizes them.

Quality bar:
- Satisfy the brief's Production-grade acceptance bar.
- Do not leave known cleanup, duplicated logic, brittle seams, TODO-driven behavior, untested behavior, or immediate refactor debt unless the brief explicitly authorizes it.

Validation:
- Validation level: FULL_REBUILD
- Allowed runtime commands: npm run verify; npm run full-rebuild; npm run setup:vps; npm run live:smoke when live credentials are available; docker compose build/up/run/down as invoked by full-rebuild.
- Required proof: negative missing-OpenClaw discovery command fails and creates no setup JSON; configure-later command succeeds and records configure-later; npm run verify; npm run full-rebuild.
- If validation cannot be made truthful inside this level, stop and report the blocker.

Stop report:
- Write a timestamped report under the active brief's reports/ folder.
- Refresh reports/LATEST.md.
- Refresh reports/LATEST.json only enough to keep it aligned with the newest stop report.
- Update automation/state.json only enough so it no longer claims stale READY_FOR_IMPLEMENTATION.
- Include a Durable memory candidates section with any facts that should be promoted to repo memory at final shipgate.
- Do not update durable repo memory at this intermediate checkpoint unless this phase explicitly requires it for later phases or fresh sessions.
- Commit and push at QA_CHECKPOINT, FINAL_SHIPGATE, or blocker stop unless the brief says otherwise.
- Report branch, files changed, tests run, implementation_commit_sha, stop_report_commit_sha, and push status.
```
