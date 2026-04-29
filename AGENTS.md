# Auto Forge Controller Agent Index

This file is the short entrypoint for coding agents. Treat it as an index, not the full source of truth.

## Read First

- `docs/agent-memory/PROJECT.md`
- `docs/agent-memory/CURRENT_STATE.md`
- `docs/agent-memory/TESTING.md`

Read these as needed by task type:

- `docs/agent-memory/ARCHITECTURE.md` for architecture-affecting work
- `docs/agent-memory/DECISIONS.md` for durable technical or product choices
- `docs/agent-memory/PARALLEL_RULES.md` for multi-agent execution
- `docs/ui/FRONTEND.md`, `docs/ui/TOKENS.md`, `docs/ui/PATTERNS.md`, and `docs/ui/REFERENCE_SCREENS.md` for frontend work when they exist
- the newest relevant file under `docs/exec-plans/active/`

## Operating Rules

- Trust live code and git state over stale docs. If they disagree, update the docs before closing the task.
- Treat `/var/www/html/auto.thapi.cc` as the source/dev checkout unless the operator explicitly designates it as the deployed runtime. Production proof flows through GitHub into the target install.
- Before editing, restate the objective, constraints, owned files, and verification plan.
- Keep changes scoped. Do not rewrite unrelated areas.
- Reuse existing patterns before introducing new abstractions.
- For parallel work, keep file ownership disjoint and let one lead handle integration.
- During active brief work, preserve continuity in the active brief report and `reports/LATEST.md`; do not rewrite durable memory at every checkpoint.
- Include durable memory candidates in stop reports so final shipgate can promote lasting facts into repo memory.
- At final shipgate or an explicit memory-maintenance stop, update `docs/agent-memory/CURRENT_STATE.md` and `docs/agent-memory/SESSION_HANDOFF.md` only if their durable facts changed.
- Update `docs/agent-memory/DECISIONS.md` only when a durable choice changed.
- Update `docs/agent-memory/TESTING.md` only when the verification path changed.

## Active Task Flow

1. Read this file and the relevant memory docs.
2. Check `git status --short` and the current GitHub branch in this repo path.
3. If the active target is dirty and no explicit dirty-repo topology policy is documented, stop and ask before changing branches or repo paths. Do not create `git worktree` directories or duplicate repo checkouts.
4. Read the current brief under `docs/exec-plans/active/` when one exists.
5. Do one bounded task batch.
6. Run the relevant commands from `docs/agent-memory/TESTING.md`.
7. Write the stop report and refresh `reports/LATEST.md`; refresh durable memory only when the current phase or final shipgate explicitly requires it.

## Memory Pack

- Project and scope: `docs/agent-memory/PROJECT.md`
- Architecture map: `docs/agent-memory/ARCHITECTURE.md`
- Decision log: `docs/agent-memory/DECISIONS.md`
- Current snapshot: `docs/agent-memory/CURRENT_STATE.md`
- Verification commands: `docs/agent-memory/TESTING.md`
- Handoff note: `docs/agent-memory/SESSION_HANDOFF.md`
- Parallel rules: `docs/agent-memory/PARALLEL_RULES.md`

## Execution Briefs

- Active briefs live in `docs/exec-plans/active/`
- Completed briefs live in `docs/exec-plans/completed/`
- Use `docs/exec-plans/TASK_BRIEF_TEMPLATE.md` as the contract for `brief-lite` and `brief-full` packs under `docs/exec-plans/active/<brief-id>/`
- Repo-local Claude automation, when present, lives under `.claude/` and `tools/forge/`
- When a brief includes `automation/state.json` and `automation/qa.json`, treat them as the machine-readable truth for the current phase and latest QA outcome
