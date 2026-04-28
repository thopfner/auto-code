# Coding Agent Prompt

## Role

You are implementing Auto Forge Controller, a production deployable automation controller for Forge workflows.

## Required Read Order

1. `README.md`
2. `AGENTS.md`
3. `docs/agent-memory/PROJECT.md`
4. `docs/agent-memory/ARCHITECTURE.md`
5. `docs/agent-memory/CURRENT_STATE.md`
6. `docs/agent-memory/TESTING.md`
7. `docs/ui/FRONTEND.md`
8. `docs/ui/TOKENS.md`
9. `docs/ui/PATTERNS.md`
10. this brief `README.md`
11. `01-brief-lineage-and-sources.md`
12. the currently authorized phase file

## Execution Rules

- Execute only the current authorized window.
- Use exact phase files as the implementation contract.
- Keep every change inside `/var/www/html/auto.thapi.cc`.
- Treat later phases as context only.
- Stop at `QA_CHECKPOINT` and `FINAL_SHIPGATE`.
- QA gates are external and may not be self-cleared.

## Production-Grade Acceptance Bar

The implementation must satisfy the brief's production-grade acceptance bar. Do not leave known cleanup, duplicated logic, brittle seams, TODO-driven behavior, untested behavior, or immediate refactor debt unless the brief explicitly authorizes that compromise.

## Reporting

Before every QA stop or blocker stop:

1. Create or identify the implementation commit when tracked code or docs changed.
2. Write one timestamped Markdown report under `reports/`.
3. Refresh `reports/LATEST.md`.
4. Refresh `reports/LATEST.json` if present.
5. Update `automation/state.json` if present so it no longer advertises stale `READY_FOR_IMPLEMENTATION`.
6. Commit report and automation changes.
7. Push unless blocked.
8. Report branch, changed files, tests, `implementation_commit_sha`, `stop_report_commit_sha`, and push status.

