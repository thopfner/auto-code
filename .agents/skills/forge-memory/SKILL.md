---
name: forge-memory
description: Initialize or maintain a repo memory pack for Codex and Claude, including AGENTS.md, CLAUDE.md, docs/agent-memory, the execution-brief contract, repo-local Claude hook automation, and optional docs/ui files for frontend repos. Use when a repo lacks stable project memory, when the existing docs have drifted, or when you need to seed or refresh the files that fresh sessions should read first.
---

# Repo Memory Pack

## Overview

Use this skill to create the repository-local memory system that long-running agent workflows depend on. It seeds a short root index plus focused markdown files that preserve project context, decisions, current state, testing, handoff notes, the canonical execution-brief contract, repo-local Claude hook automation for brief enforcement, and optional UI memory for frontend repos.

## Remote Topology Guardrail

- Scaffold and update files only inside the target repo root.
- When the user asks for a new branch or worktree, interpret that as a GitHub branch request only. Do not write templates that instruct `git worktree` creation, sibling clones, or duplicated repo folders.
- Keep compatibility `worktree` metadata fields present only when required by existing automation, and keep them `null` in normal forge workflows.

## When To Use

- The repo does not have `AGENTS.md`, `CLAUDE.md`, or `docs/agent-memory/`.
- Fresh sessions keep drifting because context lives in chat instead of the repo.
- The repo has memory docs, but they are stale or unstructured.
- You want a planner or QA agent to maintain durable project memory after each task.

## Workflow

### 1. Inspect before writing

Read the live repo before creating memory files:

- `git status --short`
- entrypoints and main modules
- package managers and build files
- test commands and tooling
- deployment or runtime hints
- frontend stack and reusable UI patterns when the repo has a frontend
- any existing project docs you should preserve or fold into the new pack

For remote repos, inspect over SSH first. Do not invent architecture or product rules that the repo does not support.

### 2. Scaffold the pack

Use [scripts/scaffold_memory_pack.py](scripts/scaffold_memory_pack.py) to generate the template set into the target repo root, or copy and adapt the files under [assets/templates](assets/templates).

Pass `--include-ui` when the repo has a meaningful frontend surface and you want durable `docs/ui/` memory from the start.

Canonical output:

```text
AGENTS.md
CLAUDE.md
.claude/
tools/forge/
docs/agent-memory/
docs/exec-plans/
docs/ui/            # optional for frontend repos
```

The default scaffold also installs repo-local Claude project hooks under `.claude/` plus shared validators under `tools/forge/`. This keeps new repos self-installing for VPS-side Claude sessions instead of relying on per-user global config.

### 3. Populate the first pass from evidence

Fill the templates from the repo itself:

- `PROJECT.md`: mission, scope, constraints, non-goals
- `ARCHITECTURE.md`: entrypoints, module map, data flow, sharp edges
- `DECISIONS.md`: durable choices and why they were made
- `CURRENT_STATE.md`: what is done, in progress, broken, or risky
- `TESTING.md`: exact verification commands and release gates
- `SESSION_HANDOFF.md`: what the next session needs immediately
- `PARALLEL_RULES.md`: ownership and repo-topology rules for multi-agent execution
- `TASK_BRIEF_TEMPLATE.md`: the canonical `brief-lite` and `brief-full` contract plus `BRIEF_ID` conventions
- `.claude/settings.json`: repo-local Claude hook registration
- `.claude/hooks/*`: stop-gate and validation-level enforcement scripts
- `tools/forge/*`: shared validators, automation-state helpers, and backfill scripts used by the hooks and QA

When the repo has a frontend, also fill:

- `docs/ui/FRONTEND.md`: stack, rendering model, routing, and accessibility expectations
- `docs/ui/TOKENS.md`: semantic tokens and style scales
- `docs/ui/PATTERNS.md`: reusable layouts, forms, tables, nav, and state patterns
- `docs/ui/REFERENCE_SCREENS.md`: canonical screens or combinations worth copying

Keep `AGENTS.md` short and map-like. Point to deeper docs instead of stuffing everything into the root.

When you scaffold the automation:

- keep the hook scripts repo-local so every Claude session in the repo gets the same enforcement
- keep the validators under `tools/forge/` so QA and ad hoc terminal checks can reuse them
- note in `CLAUDE.md` that `claude --bare` skips project hooks and should not be used for brief-driven work

### 4. Keep update rules lean and durable

During an active execution brief, do not rewrite durable repo memory at every intermediate checkpoint. Checkpoint continuity should live in the active brief's stop reports:

- write one timestamped report under the active brief's `reports/` folder
- refresh `reports/LATEST.md`
- include a `Durable memory candidates` section for facts that may need promotion at final shipgate
- refresh machine-readable stop artifacts only when the repo already uses them

At final shipgate or during an explicit memory-maintenance task:

- update `CURRENT_STATE.md` if the project state, shipped surfaces, active risks, or next work changed durably
- update `SESSION_HANDOFF.md` if the next fresh session needs different immediate context
- update `DECISIONS.md` if a durable technical or product choice changed
- update `TESTING.md` if the verification path changed
- update `PARALLEL_RULES.md` only when the team protocol changed
- update `.claude/` or `tools/forge/` only when the repo's execution protocol or validators changed
- update `docs/ui/*.md` only when durable frontend conventions changed
- move finished task briefs from `docs/exec-plans/active/` to `docs/exec-plans/completed/`

Promote only durable facts from the accumulated stop reports into repo memory. Do not copy transient phase narration, repeated status summaries, or report history into `CURRENT_STATE.md` or `SESSION_HANDOFF.md`.

### 5. For remote repos, verify delivery

If you scaffold or edit locally, copy to the VPS with `scp` and verify exact files on the host. Do not claim the memory pack exists until the remote repo shows the files.

For repos that use Claude on the host, verify all of these exact paths after delivery:

- `.claude/settings.json`
- `.claude/hooks/require-stop-artifacts.py`
- `.claude/hooks/enforce-validation-level.py`
- `.claude/hooks/enforce-phase-ownership.py`
- `tools/forge/automation_context.py`
- `tools/forge/verify_stop_artifact.py`
- `tools/forge/seed_latest_json.py`
- `tools/forge/seed_automation_state.py`

## Writing Rules

- Prefer short, high-signal markdown over long narrative docs.
- Use the repo and git state as the source of truth.
- Mark unknowns explicitly instead of guessing.
- Preserve existing useful docs; link them from the new pack instead of duplicating them.
- Keep the pack legible to both Codex and Claude.
- Keep automation default-on but repo-local; do not hide required enforcement in a user home directory.
- Do not scaffold files or folders outside the target repo root.

## References And Assets

- Open [references/memory-pack-spec.md](references/memory-pack-spec.md) for the file-by-file contract and freshness rules.
- Use [scripts/scaffold_memory_pack.py](scripts/scaffold_memory_pack.py) when you want deterministic scaffolding.
- Use the files under [assets/templates](assets/templates) when you need to inspect or customize the exact markdown templates before writing them into a repo.
