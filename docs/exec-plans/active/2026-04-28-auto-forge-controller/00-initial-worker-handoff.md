# Initial Worker Handoff

```text
You are implementing one authorized window in the active repo.

Target:
- Repo: /var/www/html/auto.thapi.cc
- Branch: main
- Brief: docs/exec-plans/active/2026-04-28-auto-forge-controller
- Authorization: 10-phase-1-foundation.md only

Read for context:
- Read mode: FULL_REHYDRATE
- Read these files, in order:
  - README.md
  - AGENTS.md
  - CLAUDE.md
  - docs/agent-memory/PROJECT.md
  - docs/agent-memory/ARCHITECTURE.md
  - docs/agent-memory/DECISIONS.md
  - docs/agent-memory/CURRENT_STATE.md
  - docs/agent-memory/TESTING.md
  - docs/agent-memory/PARALLEL_RULES.md
  - docs/ui/FRONTEND.md
  - docs/ui/TOKENS.md
  - docs/ui/PATTERNS.md
  - docs/ui/REFERENCE_SCREENS.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/README.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/01-brief-lineage-and-sources.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/10-phase-1-foundation.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/reports/LATEST.md
- Do not mention or invoke forge-bootstrap for this worker handoff.

Execute now:
- Implement only: Phase 1 - Foundation
- Goal: Create the production project foundation, state model, runner abstraction, stack decision, and first tests.
- Owned paths: the paths listed in automation/state.json for Phase 1.
- Reuse: repo-local Auto Forge skills named `auto-forge-*` under `.agents/skills/forge-*` plus shared references under `.agents/skills/references/` and the active brief contract.
- Do not change: /opt/forge-skills, unrelated VPS repos, or any secret/auth cache.
- Later phases are context only until a new handoff authorizes them.

Quality bar:
- Satisfy the brief's Production-grade acceptance bar.
- Do not leave known cleanup, duplicated logic, brittle seams, TODO-driven behavior, untested behavior, or immediate refactor debt unless the brief explicitly authorizes it.

Validation:
- Validation level: NO_RUNTIME_CHECK
- Allowed runtime commands: none
- Required proof: lint/type/unit/schema/fake-runner tests created by Phase 1, plus updated TESTING.md with exact commands.
- If validation cannot be made truthful inside this level, stop and report the blocker.

Stop report:
- Write a timestamped report under the active brief's reports/ folder.
- Refresh reports/LATEST.md.
- Refresh reports/LATEST.json only enough to keep it aligned with the newest stop report.
- Update automation/state.json only enough so it no longer claims stale READY_FOR_IMPLEMENTATION.
- Include a Durable memory candidates section with any facts that should be promoted to repo memory at final shipgate.
- Do not update durable repo memory at an intermediate checkpoint unless this phase explicitly requires it for later phases or fresh sessions.
- Commit and push at QA_CHECKPOINT, FINAL_SHIPGATE, or blocker stop unless the brief says otherwise.
- Report branch, files changed, tests run, implementation_commit_sha, stop_report_commit_sha, and push status.
```
