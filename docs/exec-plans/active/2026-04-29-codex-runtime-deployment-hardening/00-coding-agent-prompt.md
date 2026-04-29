# Initial Worker Handoff

Topology note: this file preserves the original Phase 1 handoff. Current workers must follow `README.md`, `automation/state.json`, and the currently authorized phase file. `/var/www/html/auto.thapi.cc` is the source/dev checkout; deployed-product proof happens after pushing to GitHub and pulling the accepted commit into the target install.

```text
You are implementing one authorized window in the active repo.

Target:
- Repo: /var/www/html/auto.thapi.cc
- Branch: main
- Brief: docs/exec-plans/active/2026-04-29-codex-runtime-deployment-hardening
- Authorization: 10-phase-1-codex-runtime-and-artifact-persistence.md only

Read for context:
- Read mode: FULL_REHYDRATE
- Read these files, in order:
  - AGENTS.md
  - CLAUDE.md
  - docs/agent-memory/CURRENT_STATE.md
  - docs/agent-memory/TESTING.md
  - docs/exec-plans/active/2026-04-29-codex-runtime-deployment-hardening/README.md
  - docs/exec-plans/active/2026-04-29-codex-runtime-deployment-hardening/00-problem-framing.md
  - docs/exec-plans/active/2026-04-29-codex-runtime-deployment-hardening/01-brief-lineage-and-sources.md
  - docs/exec-plans/active/2026-04-29-codex-runtime-deployment-hardening/03-root-cause-or-audit.md
  - docs/exec-plans/active/2026-04-29-codex-runtime-deployment-hardening/10-phase-1-codex-runtime-and-artifact-persistence.md
- Do not mention or invoke forge-bootstrap for this worker handoff.

Execute now:
- Implement only: 10-phase-1-codex-runtime-and-artifact-persistence.md
- Goal: Fix the Docker/installer runtime contract so codex exec has a writable active CODEX_HOME, protected OAuth source material remains separate, and prompts/artifacts persist under /data.
- Owned paths: docker-compose.yml; scripts/install-vps.sh; packages/adapters/src/codex-runner.ts; packages/core/src/workflow-engine.ts; packages/core/src/prompt-builder.ts; apps/api/src/server.ts; tools/live-external-smoke.ts; tests/codex-runner.test.ts; tests/vps-installer.test.ts; tests/telegram-workflow-api.test.ts; docs/deployment/README.md; docs/deployment/vps.md; docs/exec-plans/active/2026-04-29-codex-runtime-deployment-hardening/**
- Reuse: existing CodexCliRunner, workflow engine artifact/prompt root options, installer env generation, setup secret-reference rules, Compose data mount, and existing tests.
- Do not change: Telegram webhook ownership, OpenClaw gateway ownership, repo registry/SSH behavior, durable workflow-store architecture, unrelated UI, raw secret handling, or tools/forge/__pycache__/.
- Later phases are context only until a new handoff authorizes them.

Quality bar:
- Satisfy the brief's Production-grade acceptance bar.
- Do not leave known cleanup, duplicated logic, brittle seams, TODO-driven behavior, untested behavior, or immediate refactor debt unless the brief explicitly authorizes it.

Validation:
- Validation level: FULL_REBUILD
- Allowed runtime commands: npm run test -- --run tests/codex-runner.test.ts tests/vps-installer.test.ts tests/telegram-workflow-api.test.ts; npm run verify; docker compose build; AUTO_FORGE_API_PORT=<free-port> AUTO_FORGE_WEB_PORT=<free-port> docker compose up -d postgres api worker web; docker compose logs --tail=100 api; docker compose down --remove-orphans
- Required proof: targeted tests, npm run verify, Compose build/start/log evidence, and proof that CODEX_HOME is writable while artifacts/prompts go under the persisted data mount.
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
