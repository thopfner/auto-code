# Managed Codex CLI Worker Handoff

```text
You are implementing one authorized window in the active repo.

Target:
- Repo: /var/www/html/auto.thapi.cc
- Branch: main
- Brief: docs/exec-plans/active/2026-04-28-auto-forge-controller
- Authorization: 64-phase-5-revision-managed-codex-cli.md only

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
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/62-managed-codex-cli-problem-framing.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/63-managed-codex-cli-options-and-recommendation.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/64-phase-5-revision-managed-codex-cli.md
- Do not mention or invoke forge-bootstrap for this worker handoff.

Execute now:
- Implement only: 64-phase-5-revision-managed-codex-cli.md
- Goal: Make Codex CLI a repo-managed product dependency so fresh VPS and Docker installs do not require a global codex command.
- Owned paths: package.json, package-lock.json, scripts/bootstrap.sh, Dockerfile, .env.example, packages/adapters/src/**, packages/ops/src/**, apps/cli/src/index.ts if needed, tools/live-external-smoke.ts if needed, tests/codex-runner.test.ts, tests/ops.test.ts, docs/deployment/**, docs/agent-memory/CURRENT_STATE.md, docs/agent-memory/TESTING.md, docs/exec-plans/active/2026-04-28-auto-forge-controller/**
- Reuse: existing CodexCliRunner contract, existing health check shape, existing setup/live smoke secret-reference behavior, existing stop-report and automation artifact pattern.
- Do not change: OpenClaw fail-closed behavior, Telegram setup behavior, references-only setup JSON, Forge phase gate semantics, repo path topology, or final live-smoke credential requirements.
- Later phases are context only until a new handoff authorizes them.

Quality bar:
- Satisfy the brief's Production-grade acceptance bar.
- Do not leave known cleanup, duplicated logic, brittle seams, TODO-driven behavior, untested behavior, or immediate refactor debt unless the brief explicitly authorizes it.

Validation:
- Validation level: FULL_REBUILD
- Allowed runtime commands: npm run verify; npm run full-rebuild; npm run test -- --run tests/codex-runner.test.ts; npm run ops:health; npm run live:smoke; docker compose build; docker compose up; docker compose run; docker compose down
- Required proof: npm run verify, npm run full-rebuild, PATH=/usr/bin:/bin npm run test -- --run tests/codex-runner.test.ts, and PATH=/usr/bin:/bin npm run ops:health. If live credentials are present, also run npm run live:smoke.
- If validation cannot be made truthful inside this level, stop and report the blocker.

Stop report:
- Write a timestamped report under the active brief's reports/ folder.
- Refresh reports/LATEST.md.
- Refresh reports/LATEST.json only when present and only enough to keep it aligned with the newest stop report.
- Update automation/state.json only when present and only enough so it no longer claims stale READY_FOR_IMPLEMENTATION.
- Include a Durable memory candidates section with any facts that should be promoted to repo memory at final shipgate.
- This phase explicitly authorizes updating docs/agent-memory/CURRENT_STATE.md and docs/agent-memory/TESTING.md because the durable runtime/testing contract changes.
- Commit and push at QA_CHECKPOINT, FINAL_SHIPGATE, or blocker stop unless the brief says otherwise.
- Report branch, files changed, tests run, implementation_commit_sha, stop_report_commit_sha, and push status.
```
