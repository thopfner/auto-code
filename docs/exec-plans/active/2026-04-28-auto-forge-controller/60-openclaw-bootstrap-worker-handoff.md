# OpenClaw Bootstrap Worker Handoff

```text
You are implementing one authorized window in the active repo.

Target:
- Repo: /var/www/html/auto.thapi.cc
- Branch: main
- Brief: docs/exec-plans/active/2026-04-28-auto-forge-controller
- Authorization: 59-phase-5-revision-openclaw-bootstrap.md only

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
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/57-openclaw-bootstrap-problem-framing.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/58-openclaw-bootstrap-options-and-recommendation.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/59-phase-5-revision-openclaw-bootstrap.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/LATEST.md
- Do not mention or invoke forge-bootstrap for this worker handoff.

Execute now:
- Implement only: 59-phase-5-revision-openclaw-bootstrap.md
- Goal: make fresh-VPS setup automate/detect OpenClaw gateway setup instead of asking a noob operator for an OpenClaw token.
- Owned paths: apps/**, packages/**, tools/**, tests/**, docs/deployment/**, .env.example, docs/exec-plans/active/2026-04-28-auto-forge-controller/**
- Reuse: existing setup wizard, setup validation, fake adapter tests, health/live smoke patterns, references-only setup persistence.
- Do not change: global /opt/forge-skills, unrelated product architecture, Telegram/OpenAI credential requirements, repo path, or branch topology.
- Later phases are context only until a new handoff authorizes them.

Quality bar:
- Satisfy the brief's Production-grade acceptance bar.
- Do not leave known cleanup, duplicated logic, brittle seams, TODO-driven behavior, untested behavior, or immediate refactor debt unless the brief explicitly authorizes it.

Validation:
- Validation level: FULL_REBUILD
- Allowed runtime commands: npm run verify; npm run full-rebuild; npm run live:smoke when live credentials are available; npm run setup:vps; docker compose build/up/run/down as invoked by full-rebuild.
- Required proof: npm run verify; deterministic default setup proof with no OpenClaw token requirement; proof setup JSON remains references-only; proof missing OPENCLAW_TOKEN alone is not the default blocker; npm run full-rebuild.
- If validation cannot be made truthful inside this level, stop and report the blocker.

Stop report:
- Write a timestamped report under the active brief's reports/ folder.
- Refresh reports/LATEST.md.
- Refresh reports/LATEST.json only when present and only enough to keep it aligned with the newest stop report.
- Update automation/state.json only when present and only enough so it no longer claims stale READY_FOR_IMPLEMENTATION.
- Include a Durable memory candidates section with any facts that should be promoted to repo memory at final shipgate.
- Do not update durable repo memory at an intermediate checkpoint unless this phase explicitly requires it for later phases or fresh sessions.
- Commit and push at QA_CHECKPOINT, FINAL_SHIPGATE, or blocker stop unless the brief says otherwise.
- Report branch, files changed, tests run, implementation_commit_sha, stop_report_commit_sha, and push status.
```
