# Elite Protocol for Codex + Claude on a VPS

## Core Principles

- The repo is the source of truth. Chat history is disposable working memory.
- `AGENTS.md` is an index, not an encyclopedia.
- Deep context lives in versioned markdown inside the repo.
- Plans are first-class artifacts, not hidden inside old conversations.
- Every phase ends with a repo-state update, not just a code diff.

## Recommended Role Split

- `Codex local`: planning lead, brief author, QA reviewer, and repo-memory maintainer.
- `Claude lead on VPS`: execution lead and integrator with direct access to the repo.
- `Claude workers`: focused implementers or researchers who stay inside the active repo path. Forge does not create duplicate checkouts.

This split works because the planner and reviewer keep cross-task continuity, while the execution lead and workers stay close to the code and runtime environment.

## Canonical Repo Layout

```text
AGENTS.md
CLAUDE.md
.claude/
  settings.json
  hooks/
tools/
  forge/
docs/
  agent-memory/
    PROJECT.md
    ARCHITECTURE.md
    DECISIONS.md
    CURRENT_STATE.md
    TESTING.md
    SESSION_HANDOFF.md
    PARALLEL_RULES.md
  exec-plans/
    TASK_BRIEF_TEMPLATE.md
    active/
    completed/
  ui/                  # optional for frontend repos
    FRONTEND.md
    TOKENS.md
    PATTERNS.md
    REFERENCE_SCREENS.md
```

Keep `AGENTS.md` short. The repo memory should live under `docs/agent-memory/`, and task packets should live under `docs/exec-plans/`.
When the execution lead is Claude on the repo host, keep project-scoped hooks under `.claude/` and shared validators under `tools/forge/` so the protocol follows the repo instead of a specific user account.

## Standard Operating Loop

1. Rehydrate from the repo.
2. Refresh or write the active task brief pack (`brief-lite` or `brief-full`).
3. Split the task into disjoint owned surfaces.
4. Run research first if the problem is ambiguous.
5. Parallelize read-only analysis freely, and serialize code-writing inside the active repo path unless the user already provided another checkout.
6. Integrate through one lead.
7. Run QA as a separate pass.
8. Update repo memory before stopping.
9. Enforce stop gates and validation-level drift with repo-local hooks when the repo uses Claude for implementation.

## Planner, Lead, and Worker Responsibilities

### Codex planner or QA pass

- read the repo memory pack and active brief
- inspect live repo state over SSH before trusting docs
- write or refine the task brief
- review diffs, test evidence, and regressions after implementation
- update `CURRENT_STATE.md` and `SESSION_HANDOFF.md` when the batch closes

### Claude lead on the VPS

- read `CLAUDE.md`, `AGENTS.md`, repo memory docs, and the active brief
- run Claude normally inside the repo so project hooks load; avoid `claude --bare` for brief-driven work
- own integration, shared interfaces, and final local verification
- keep workers off overlapping files
- stop and escalate if the brief is wrong or dependencies are unresolved

### Claude workers

- read the same repo memory entrypoints plus the active brief
- own a disjoint file set
- report exact files changed, tests run, and blockers
- avoid changing global docs unless the lead explicitly assigns that work

## Parallel Worker Protocol

### When parallelism helps

- frontend, backend, and tests are separable
- a review can be split by lens such as security, performance, and test coverage
- a bug investigation benefits from competing hypotheses
- a feature spans independent modules with minimal interface churn

### When parallelism hurts

- two workers need to edit the same file
- the API contract is still unstable
- the work is mostly sequential
- the repo memory is stale or absent
- the task is a broad refactor without clear ownership boundaries

### Team size

- `1 worker`: ambiguous legacy area or unstable interface work
- `2-3 teammates`: default when analysis, testing, or QA can be split cleanly
- `4-5 teammates`: only when ownership is very clean and most teammates can stay read-only

For most feature work, one lead plus a small teammate set is the practical sweet spot:

- worker 1: backend or data path
- worker 2: frontend or presentation path
- worker 3: tests, fixtures, docs, telemetry, or adapter work

## Branch And Repo-Path Rules

- Treat the active repo path as the only allowed filesystem root for forge execution.
- If the user asks for a new branch or worktree, interpret that as a GitHub branch request only.
- Do not create `git worktree` directories, sibling clones, `.claude/worktrees/`, or any duplicated repo folder structure through forge.
- Keep all briefs, reports, and automation files inside the active repo path.
- Dirty active repo state is a topology decision boundary, not an automatic trigger.
- If the active target is dirty, stop and ask before changing branches or repo paths.

## Task Packet Contract

Every worker task should define:

- objective
- owned files or modules
- non-goals
- invariants
- exact verification commands
- blocker conditions
- required completion report

Good task packets reduce drift more than bigger context windows do.
When the repo uses hooks, the task packet should also define the truthful validation level and keep `reports/LATEST.md` plus `reports/LATEST.json` aligned with the newest stop report.

For low-risk single-surface work, default to `brief-lite`. Escalate to `brief-full` only when the extra files protect a real coordination or risk boundary.

## Suggested Execution Modes

### New feature

- planner writes the brief
- lead decomposes into backend, frontend, and tests/docs slices
- teammates can research or validate in parallel, but code-writing stays on the active GitHub branch in the active repo path
- lead integrates and runs full verification
- QA pass reviews the result against the brief

### Ambiguous bug

- spawn research workers first with competing hypotheses
- keep them read-only until one root cause survives review
- then assign one implementer or one implementation batch

### QA swarm

- one reviewer for correctness or regressions
- one reviewer for security or data integrity
- one reviewer for tests and release gating

## Anti-Drift Rules

- If code and docs disagree, code wins until the docs are updated.
- Do not allow important decisions to live only in chat.
- Keep the active brief smaller than the entire feature spec.
- Re-open planning when interfaces, schema, or invariants change.
- A task is not complete until the relevant memory files reflect reality.
- If the active target is dirty and execution topology is not explicitly documented, stop and ask before changing branches or repo paths. Do not create duplicate repo directories.

## Speed Without Chaos

- Keep tasks to roughly one coherent surface, not a giant epic.
- Default to `brief-lite` for one-surface low-risk batches.
- Prefer reusing existing patterns and files instead of inventing new ones mid-flight.
- Use cheaper or faster models for bounded research and test-running when available.
- Keep the strongest model on the lead or reviewer role.
- Add notification hooks so the lead can supervise multiple workers without staring at the terminal.

## Completion Contract

Every completed batch should leave behind:

- updated code
- an updated active or completed brief
- refreshed `CURRENT_STATE.md`
- refreshed `SESSION_HANDOFF.md`
- `DECISIONS.md` updates if a durable choice changed
- `TESTING.md` updates if the verification path changed
