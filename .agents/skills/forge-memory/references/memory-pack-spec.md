# Memory Pack Specification

## Canonical Layout

```text
AGENTS.md
CLAUDE.md
.claude/
  settings.json
  hooks/
    enforce-validation-level.py
    enforce-phase-ownership.py
    require-stop-artifacts.py
tools/
  forge/
    automation_context.py
    seed_automation_state.py
    seed_latest_json.py
    verify_stop_artifact.py
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

## Design Rules

- `AGENTS.md` should stay short and index-like.
- `CLAUDE.md` should be even shorter and import or point to `AGENTS.md`.
- Keep repo-local Claude hook automation under `.claude/` when the repo uses brief-driven Claude execution.
- Keep reusable validators under `tools/forge/` so hooks, QA, and ad hoc checks share one truth source.
- Keep deep context in `docs/agent-memory/`.
- Keep task packets in `docs/exec-plans/`.
- Keep durable frontend conventions in `docs/ui/` when the repo has meaningful UI work.
- Prefer progressive disclosure: small root docs, deeper references only when needed.

## File Contract

### AGENTS.md

Purpose:

- shortest repo entrypoint for coding agents
- names the required follow-up docs
- states non-negotiable operating rules

Target size:

- roughly 60-120 lines

### CLAUDE.md

Purpose:

- Claude-specific repo memory
- usually imports or points to `AGENTS.md`
- records repo-topology and teammate rules that matter at session start
- records whether repo-local project hooks are part of the workflow

Target size:

- roughly 5-40 lines

If repo-local project hooks exist:

- tell users to run Claude from the repo root so project hooks load
- tell users not to use `claude --bare` for brief-driven work, because bare mode skips hooks

### .claude/settings.json

Purpose:

- project-scoped Claude hook configuration
- enables repo-local enforcement instead of relying on per-user global setup

Update when:

- the repo's execution protocol or hook wiring changes

### .claude/hooks/*

Purpose:

- enforce stop-artifact truth at `Stop`
- enforce validation-level drift rules at `PreToolUse`

Update when:

- the brief protocol changes
- a validator moves or changes its required input shape

### tools/forge/*

Purpose:

- shared validators and helper scripts that hooks and QA can both call
- keep enforcement logic testable outside the hook runtime itself

Update when:

- stop-artifact fields change
- automation backfill rules change

### PROJECT.md

Purpose:

- what the project is
- in-scope and out-of-scope areas
- product constraints the code does not reveal by itself

Update when:

- goals, scope, or external constraints change

### ARCHITECTURE.md

Purpose:

- entrypoints
- module and service map
- data flow
- sharp edges and legacy zones

Update when:

- a durable architectural path or ownership boundary changes

### DECISIONS.md

Purpose:

- durable decision log
- records why a choice was made, not just what changed

Update when:

- a technical, operational, or product choice should survive past the current task

### CURRENT_STATE.md

Purpose:

- current snapshot of what works, what is in flight, and what is risky

Update when:

- every meaningful task batch closes

### TESTING.md

Purpose:

- exact commands for fast checks and full verification
- env prerequisites
- release gates or high-risk surfaces

Update when:

- commands, tooling, fixtures, or release checks change

### SESSION_HANDOFF.md

Purpose:

- the shortest possible handoff for the next session
- what just changed, what remains, and the best next prompt

Update when:

- every session ends

### PARALLEL_RULES.md

Purpose:

- file ownership rules
- repo-topology rules
- lead and worker responsibilities
- stop conditions for parallel work
- dirty-repo topology policy when the active target is already modified

Update when:

- team process or branching strategy changes

### docs/ui/*

Purpose:

- durable frontend memory for planners, workers, and QA
- shared tokens, patterns, and reference screens that should not live only in prompts

Use when:

- the repo has a meaningful frontend surface
- UI conventions matter across more than one task or session

### TASK_BRIEF_TEMPLATE.md and active briefs

Purpose:

- canonical contract for `brief-lite` and `brief-full` packs under `docs/exec-plans/active/<brief-id>/`
- bounded task packets with scope, owned files, verification, reporting, lineage, and completion criteria
- explicit per-phase runtime validation levels so rebuild and restart cost matches the actual change
- explicit worker authorization windows so handoff prompts do not silently authorize the whole pack
- explicit read modes so repeated same-brief execution does not require full repo-memory rereads every time

Default `BRIEF_ID`:

- `YYYY-MM-DD-<task-slug>`
- keep one stable brief folder per task batch
- record revisions as `v1`, `v2`, `v3` inside `01-brief-lineage-and-sources.md` instead of inventing a new naming scheme unless the project already has one

Use `brief-lite` when all are true:

- one coherent surface
- one branch or worker
- no schema or migration change
- no new external integration
- no auth, security, or performance-sensitive seam
- no shared UI-system, navigation, or token work
- no multi-phase decomposition is needed

`brief-lite` minimum files:

1. `README.md`
2. `00-coding-agent-prompt.md`
3. `01-brief-lineage-and-sources.md`
4. `10-phase-1-implementation.md`
5. `90-final-qa-and-merge-gate.md`
6. `99-memory-pack-update.md`
7. `reports/README.md`

When the repo uses V3A automation, also include:

- `automation/state.json`
- `automation/qa.json`

Use `brief-full` when any are true:

- multiple phases are needed
- schema, auth, security, performance, or integration risk exists
- more than one major surface is involved
- branch coordination or serialized ownership handoffs are expected
- shared UI-system, navigation, or token work is involved
- a standalone branch plan or audit file is valuable

`brief-full` minimum files:

1. `README.md`
2. `00-coding-agent-prompt.md`
3. `01-brief-lineage-and-sources.md`
4. `02-branch-and-worktree-plan.md`
5. `03-root-cause-or-audit.md`
6. `10-phase-1-implementation.md`
7. `20-phase-2-implementation.md` if needed
8. `30-phase-3-implementation.md` if needed
9. `90-final-qa-and-merge-gate.md`
10. `99-memory-pack-update.md`
11. `reports/README.md`

Keep the legacy filename `02-branch-and-worktree-plan.md` for compatibility, but use it to document branch ownership and confirm that no duplicate repo path is authorized.

When the repo uses V3A automation, also include:

- `automation/state.json`
- `automation/qa.json`

Execution window rules:

- every worker handoff must separate `Read for context` from `Execute now`
- every worker handoff must declare `FULL_REHYDRATE`, `BRIEF_REHYDRATE`, or `HOT_RESUME`
- the initial handoff authorizes only the first phase or first contiguous `AUTONOMOUS` block
- later phases remain context only until a new handoff prompt authorizes them
- `QA_CHECKPOINT` and `FINAL_SHIPGATE` are external review gates and may not be self-cleared by the coding agent
- every QA stop must refresh `reports/LATEST.md`
- every stop report must include `Durable memory candidates`: concise facts that may need promotion into repo memory at final shipgate
- when repo-local automation is installed, every QA stop must refresh only the `reports/LATEST.json` fields needed to keep it aligned with `reports/LATEST.md` and the verified stop state
- when the repo uses V3A automation, every coding-agent stop must refresh only the `automation/state.json` fields needed so the repo no longer advertises stale `READY_FOR_IMPLEMENTATION`
- when the repo uses V3A automation, every QA outcome must refresh only the `automation/qa.json` and next authorized `automation/state.json` fields needed for the next handoff
- every `QA_CHECKPOINT`, `FINAL_SHIPGATE`, or blocker stop should leave the active branch committed and should distinguish `implementation_commit_sha` from `stop_report_commit_sha`
- push at every `QA_CHECKPOINT` and `FINAL_SHIPGATE` unless repo policy or the brief explicitly says otherwise
- default git endpoint is commit and push on the active branch; merge-to-`main` or PR actions require explicit user instruction
- brief-local or reports-only drift that QA can verify directly should be repaired inline by QA instead of triggering a new revision pack
- when QA performs such an inline repair, `implementation_commit_sha` stays attached to the accepted implementation and any QA-authored repair commit becomes the new `stop_report_commit_sha`
- worker checkpoints should run the smallest truthful delta suite for the files changed since the last green evidence
- QA should rerun independently at final shipgate, after high-risk deltas, or when worker evidence is untrustworthy instead of repeating identical suites at every stop
- intermediate checkpoints use a lean continuity contract: pushed code state, one timestamped report, `reports/LATEST.md`, durable memory candidates, and required machine-readable state only when already in use
- intermediate checkpoints do not update full durable repo memory unless the phase changed architecture, testing, deployment, runtime-contract, or durable product-state facts needed before final shipgate
- final archive and memory closeout should normally be reported in one terminal shipgate summary, not fragmented into extra closeout reports
- final clearance should archive the accepted brief from `docs/exec-plans/active/` into `docs/exec-plans/completed/` and verify that archived path unless the brief explicitly overrides the completed-path rule

Read mode rules:

- `FULL_REHYDRATE`: use on a fresh session, new GitHub branch, new brief, or meaningful stale-context risk
- `BRIEF_REHYDRATE`: default for same-brief continuation after QA on the same repo path and GitHub branch
- `HOT_RESUME`: only for same live session when branch, repo path, brief, and stop conditions are materially unchanged
- `FULL_REHYDRATE` should read `AGENTS.md`, `CLAUDE.md`, `CURRENT_STATE.md`, `TESTING.md`, brief `README.md`, `01-brief-lineage-and-sources.md`, and the current authorized phase file(s)
- `BRIEF_REHYDRATE` should usually read brief `README.md`, the current authorized phase file(s), `reports/LATEST.md`, and reread `01-brief-lineage-and-sources.md` only when it changed or the handoff says to
- `HOT_RESUME` should usually read only the new handoff prompt, the current authorized phase file(s), and any changed `reports/LATEST.md`
- same-brief continuation should treat brief `README.md`, the current authorized phase file(s), and `reports/LATEST.md` as the default delta context
- when repo-local automation is installed, `reports/LATEST.json` should mirror the same stop state as `reports/LATEST.md`
- when the repo uses V3A automation, `automation/state.json` should be the machine-readable source of truth for the currently authorized phase, execution status, validation level, and owned file paths
- escalate to a broader reread only when the branch or active repo target changed, the active brief changed materially, brief lineage changed materially, dirty state or topology changed, durable testing or architecture assumptions changed, or the smaller context set cannot support truthful execution or QA
- additional repo-memory or UI docs should be pulled in only when the brief names them as authoritative for the current phase or when the agent detects a real ambiguity

Phase validation levels:

- `NO_RUNTIME_CHECK`: use static analysis, diff review, or automated tests only; no browser runtime proof is required for the phase
- `LIVE_RELOAD`: use the already-running stack and refresh the browser; do not rebuild or restart services unless the runtime proves stale or blocked
- `SERVICE_RESTART`: restart only the directly affected service or services; a service-scoped image rebuild or recreate is still acceptable when the phase explicitly names that command family for the affected service; do not rebuild the full stack unless the phase explicitly requires it
- `FULL_REBUILD`: rebuild the affected image or stack because a runtime boundary changed and cheaper validation would not be truthful

Default rule:

- choose the cheapest truthful validation level for each phase
- do not default to `docker compose up --build` after every phase
- if the repo uses validation-enforcement hooks, list any explicitly allowed restart or rebuild commands in the phase so the command guard can distinguish planned runtime work from drift
- if the repo uses V3A ownership hooks, define repo-root-relative `owned_paths` for each phase so file-write enforcement is explicit instead of inferred from prose

Require `FULL_REBUILD` only when the phase changes a real runtime boundary such as:

- `Dockerfile` or image build layers
- compose wiring or service topology
- dependency install layers or lockfiles that affect the running image
- env or runtime wiring
- migrations or schema-sensitive startup behavior
- native modules or system packages
- asset or build pipeline configuration
- reverse proxy, network, or cross-service contract behavior

Update when:

- a new meaningful task batch starts

## Freshness Policy

- If docs and code disagree, update the docs before closing the task.
- If a file has gone stale, say so explicitly instead of silently trusting it.
- If the repo changes faster than the docs can be maintained, shrink the docs and keep only the highest-value fields current.
- During active brief work, use stop reports and `reports/LATEST.md` as the temporary source of truth. Promote durable facts into repo memory at final shipgate.

## Suggested Maintenance Rhythm

- start of batch: refresh or write the active brief
- intermediate checkpoint: write a stop report with durable memory candidates and refresh `reports/LATEST.md`
- final shipgate: update `CURRENT_STATE.md` and `SESSION_HANDOFF.md` only if their durable facts changed
- final durable decision: update `DECISIONS.md`
- final workflow/tooling change: update `TESTING.md`
- end of final accepted implementation pack or shipgate: perform the memory updates during QA close-out before declaring the batch cleared
