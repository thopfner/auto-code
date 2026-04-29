# Installer Bootstrap Env Message Worker Handoff

```text
You are implementing one authorized revision in the active repo.

Target:
- Repo: /var/www/html/auto.thapi.cc
- Branch: main
- Brief: docs/exec-plans/active/2026-04-28-auto-forge-controller
- Authorization: 76-phase-5-revision-installer-bootstrap-env-message.md only

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
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/74-phase-5-revision-installer-ux-auth-polish.md
  - docs/exec-plans/active/2026-04-28-auto-forge-controller/76-phase-5-revision-installer-bootstrap-env-message.md
- Do not mention or invoke forge-bootstrap for this worker handoff.

Execute now:
- Implement only: 76-phase-5-revision-installer-bootstrap-env-message.md
- Goal: remove the remaining fresh-install contradictory bootstrap output when installer-mode bootstrap creates a missing .env file, while preserving standalone bootstrap behavior.
- Owned paths: scripts/bootstrap.sh, tests/vps-installer.test.ts, docs/deployment/** if stale, docs/exec-plans/active/2026-04-28-auto-forge-controller/**
- Reuse: existing installer-mode bootstrap flag, existing installer dry-run tests, existing setup JSON references-only policy, existing stop-report artifact pattern.
- Do not change: OpenClaw fail-closed default behavior, Telegram discovery retry/manual fallback, setup JSON references-only policy, runtime env mode 0600, managed Codex dependency, Docker Compose runtime env alignment, API-key-only installer Codex auth, repo path topology, or Forge phase gates.
- Later phases are context only until a new handoff authorizes them.

Quality bar:
- Satisfy the brief's Production-grade acceptance bar.
- The normal noobie VPS path must not show stale standalone instructions when .env is missing.
- Do not leave known cleanup, duplicated logic, brittle seams, TODO-driven behavior, untested behavior, or immediate refactor debt unless the brief explicitly authorizes it.

Validation:
- Validation level: FULL_REBUILD
- Required proof: bash -n scripts/install-vps.sh; bash -n scripts/bootstrap.sh; npm run test -- --run tests/vps-installer.test.ts tests/vps-setup-wizard.test.ts; npm run verify; npm run full-rebuild; the installer dry-run redaction/coherent-output proof; and the missing-env-file bootstrap proof from the brief.
- If validation cannot be made truthful inside this level, stop and report the blocker.

Stop report:
- Write a timestamped report under the active brief's reports/ folder.
- Refresh reports/LATEST.md.
- Refresh reports/LATEST.json only enough to keep it aligned with the newest stop report.
- Update automation/state.json only enough so it no longer claims stale READY_FOR_IMPLEMENTATION.
- Include a Durable memory candidates section with any facts that should be promoted to repo memory at final shipgate.
- Commit and push at QA_CHECKPOINT, FINAL_SHIPGATE, or blocker stop.
- Report branch, files changed, tests run, implementation_commit_sha, stop_report_commit_sha, and push status.
```

