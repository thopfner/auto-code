---
name: forge-bootstrap
description: Bootstrap a fresh Codex or Claude session against a VPS-hosted repo by connecting over SSH, reading AGENTS.md, CLAUDE.md, the repo memory pack, and the repo-local Claude automation state, then restating the current state before planning, QA, or coding. Use when the user provides SSH instructions, asks for a fresh-session rehydration, or wants repo context without relying on old chat history.
---

# VPS Repo Bootstrap

## Overview

Use this skill to rebuild project context from the repository itself instead of from stale conversation history. It is the default entrypoint for fresh planning, QA, or implementation sessions against a VPS-hosted repo.

If the repo does not already contain `AGENTS.md`, `CLAUDE.md`, or `docs/agent-memory/`, switch to [$forge-memory](.agents/skills/forge-memory/SKILL.md). If the repo expects brief-driven Claude execution but is missing `.claude/` or `tools/forge/`, treat that as memory-pack drift and recommend a `forge-memory` refresh instead of assuming hooks exist.

Bootstrap surfaces stale docs, missing automation, dirty-state risk, and any active brief's production-grade acceptance bar. It does not repair docs, redefine the quality bar, or close memory drift unless the user explicitly changes the task to memory or doc maintenance.

## Remote Topology Guardrail

- Treat the active VPS repo path as the only allowed filesystem root for forge work.
- When the user asks for a new branch or worktree, interpret that as a GitHub branch request only. Do not create `git worktree` directories, sibling clones, or duplicated repo folders.
- Keep all plan, QA, memory-pack, and automation writes inside the active repo path.

## When To Use

- The user starts a new session and gives you VPS SSH access plus a repo path.
- The user wants planning, QA, or implementation without inheriting drift from an old thread.
- The user asks you to read the repo memory docs first.
- The repo has active execution briefs under `docs/exec-plans/`.

## Bootstrap Workflow

### 1. Confirm the operating target

Establish:

- SSH host or alias
- remote repo path
- task type: `planning`, `qa`, or `implementation`
- whether the user wants read-only analysis or is authorizing edits

If one value is missing and cannot be inferred safely, ask only for that value.

### 2. Inspect the live repo before trusting docs

Always start with live repo state:

- `git status --short`
- `git branch --show-current`
- locate `AGENTS.md`, `CLAUDE.md`, `.claude/`, `tools/forge/`, `docs/agent-memory/`, and `docs/exec-plans/`
- note whether the active repo path is dirty or already mid-task
- treat dirty active state as a topology decision boundary for new planning or implementation work

Prefer fast read-only probes first:

```bash
ssh "$HOST" "cd '$REPO' && git status --short && git branch --show-current"
ssh "$HOST" "cd '$REPO' && rg --files | rg '(^AGENTS\\.md$|^CLAUDE\\.md$|^\\.claude/|^tools/forge/|^docs/agent-memory/|^docs/exec-plans/)'"
```

### 3. Read the repo memory in order

Read these files in this order when they exist:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/agent-memory/PROJECT.md`
4. `docs/agent-memory/ARCHITECTURE.md`
5. `docs/agent-memory/DECISIONS.md`
6. `docs/agent-memory/CURRENT_STATE.md`
7. `docs/agent-memory/TESTING.md`
8. `docs/agent-memory/SESSION_HANDOFF.md`
9. `docs/agent-memory/PARALLEL_RULES.md` if the user wants multiple workers
10. the newest relevant brief under `docs/exec-plans/active/`

If the task is architecture-heavy, also read the latest completed brief that touched the same surface.
If the task is frontend-heavy, also read `docs/ui/FRONTEND.md`, `docs/ui/TOKENS.md`, `docs/ui/PATTERNS.md`, and `docs/ui/REFERENCE_SCREENS.md` when present.
If the same repo path, GitHub branch, `HEAD`, `git status --short`, and active brief folder were already confirmed earlier in the session, you may abbreviate rehydration to changed files plus newly relevant memory docs.
If `.claude/settings.json` exists, also verify whether the repo-local hooks and the `tools/forge/` validators they call are present. If the repo uses brief-driven Claude execution and those files are missing, flag the automation as incomplete.
If the active brief uses V3A automation, also read `automation/state.json` and `automation/qa.json` under that brief and treat them as the machine-readable execution-state summary.
If the active brief names a `Production-grade acceptance bar` or required quality bar, carry it forward as authoritative context for planning, QA, or implementation. Do not weaken it during bootstrap.

If the active target is dirty and the task is planning or implementation:

- do not autonomously create a `git worktree`, duplicate checkout, or switch to a different repo path solely because the current repo path is dirty
- first check whether `CLAUDE.md` or `docs/agent-memory/PARALLEL_RULES.md` explicitly defines a dirty-repo topology policy
- if no explicit policy exists, summarize the dirty state and stop for user direction before choosing the execution topology
- acceptable user-approved directions include:
  - continue in the active repo path on the current branch
  - switch the active repo path to a different GitHub branch
  - clean, stash, or otherwise resolve the dirty state first

### 4. Reconcile docs with code

Do not assume the markdown is current. Check that:

- key paths named in `ARCHITECTURE.md` still exist
- commands in `TESTING.md` still match the toolchain
- the claimed current state matches `git status`, current branches, and recent file structure
- active briefs still map to the code as it exists today
- repo-local Claude automation still maps to the brief contract if `.claude/` and `tools/forge/` exist
- active-brief `automation/state.json` and `automation/qa.json` still match the real authorized phase and latest QA outcome when they exist

If docs and code disagree:

- trust the live code and git state
- explicitly mark the docs as stale in your summary
- recommend the narrowest follow-up owner, such as `forge-memory`, `forge-qa-brief`, or an explicit doc-maintenance task
- do not repair stale docs during bootstrap unless the user explicitly authorizes memory or doc maintenance as the current task

### 5. Produce a rehydration summary before doing any work

Before planning or coding, restate:

- what the project is
- what is confirmed vs assumed
- current GitHub branch and active repo path state
- the architecture surfaces relevant to the task
- invariants and do-not-break rules
- validation commands
- any active production-grade acceptance bar or required quality bar
- stale or missing docs
- whether repo-local Claude automation is installed, missing, or drifted
- whether dirty repo state created a topology decision that needs user approval
- the smallest sensible next task slice

Keep this summary short enough to reuse as the next prompt.

### 6. Only then plan, QA, or implement

- For `planning`, stop after the brief or runbook is ready.
- For `qa`, lead with findings and verification evidence.
- For `implementation`, restate scope and owned files before editing.

## Remote Delivery Rules

- For planning-only work, do not modify remote app code.
- If you create a plan bundle locally, copy it with `scp` and verify its presence on the host.
- If you edit remote repo docs, verify the exact files after the write.

## Output Contract

Every bootstrap run should leave the user with:

- a concise current-state summary
- a list of the authoritative files you actually read
- any active production-grade acceptance bar or required quality bar you found
- a note on anything stale or missing
- a recommended next action

## References

- Open [references/elite-protocol.md](references/elite-protocol.md) when the user asks how to structure Codex planning, QA, Claude execution, or parallel workers.
- Open [references/startup-prompts.md](references/startup-prompts.md) when you need copy-ready prompts for a fresh Codex or Claude session.
