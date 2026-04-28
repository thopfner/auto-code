# Planning Artifacts

Use these structures when deep-mode planning is accepted and the rationale should live in the brief lineage.

## 00-problem-framing.md

Required sections:

1. Objective
2. Desired outcome
3. In scope
4. Out of scope
5. Constraints and invariants
6. Relevant code surfaces
7. Unknowns and risks

Required characteristics:

- short and factual
- grounded in the current codebase
- clear enough that a fresh session can understand the task quickly

## 01-options-and-recommendation.md

Required sections:

1. Sources checked
2. Option A
3. Option B
4. Option C if needed
5. Recommended approach
6. Why this is the best fit for the repo now
7. What would justify a different choice later

Required characteristics:

- compare real options, not strawmen
- distinguish codebase evidence from external best-practice evidence
- make tradeoffs explicit
- keep the recommendation decisive

## Transition To Execution

After the user agrees:

- create the `BRIEF_ID` using `YYYY-MM-DD-<task-slug>` unless the repo already has a stricter naming rule
- save these files under `docs/exec-plans/active/<brief-id>/` inside the active repo path only
- choose `brief-lite` when the task is one coherent surface with one worker and no high-risk seam
- choose `brief-full` when the task needs multiple phases, parallel ownership, or a dedicated audit layer
- for each phase, name exact files only when current repo inspection confirms them; otherwise name concrete modules or surfaces and clearly label any likely file candidates as likely rather than fixed
- assign a per-phase `validation_level`: `NO_RUNTIME_CHECK`, `LIVE_RELOAD`, `SERVICE_RESTART`, or `FULL_REBUILD`
- use the cheapest truthful validation level for each phase; justify every `FULL_REBUILD`
- when a single frontend or backend service is image-baked and needs a service-scoped rebuild or recreate to become truthful, keep that phase under `SERVICE_RESTART` only if the exact service-bound command family is listed in `allowed_commands`
- reserve `FULL_REBUILD` for stack-wide or multi-service rebuilds, or real runtime-boundary changes
- initialize `reports/LATEST.json` for the pack when machine-readable stop artifacts are in use, and require every worker stop to keep it truthful alongside `reports/LATEST.md` without adding broad documentation work at intermediate checkpoints
- when the repo already uses automation metadata or the task will run through repeated QA loops, scaffold `automation/state.json` and `automation/qa.json`
- in `automation/state.json`, record the first `authorized_phase`, `status` as `READY_FOR_IMPLEMENTATION`, the planned `read_mode`, `validation_level`, `owned_paths`, any explicitly allowed runtime commands, the target GitHub branch, and `worktree` as `null`
- in `automation/qa.json`, record `qa_status` as `NOT_REVIEWED`, the initial `next_authorized_phase`, and empty finding metadata
- for initial feature planning under `forge-plan`, generate the coding-agent pack directly
- default the pack to checkpointed autonomy for multi-phase work
- define the initial authorized execution window as the first phase or first contiguous `AUTONOMOUS` block only
- keep later phases context-only until QA or a new handoff prompt authorizes them
- use the compact worker handoff shape in `.agents/skills/references/worker-handoff-prompt-shape.md`
- make the worker handoff separate `Read for context` from `Execute now`
- state that `QA_CHECKPOINT` and `FINAL_SHIPGATE` are external review gates that the coding agent may not self-clear
- require a checkpoint commit, reported SHA, and push status at every review gate or blocker stop
- require lean checkpoint continuity: pushed code state, one timestamped stop report, `reports/LATEST.md`, and required machine-readable state only when already in use
- defer durable repo memory updates to final shipgate unless an intermediate phase changes architecture, testing, deployment, runtime-contract, or durable product-state facts needed by later phases or fresh sessions
- do not create `git worktree` directories, duplicate repo folders, or write plan files outside the active repo path
- SCP it to the VPS repo
- verify the remote brief folder and `README.md`
- return the verified handoff reference and worker launch prompt automatically
- use `forge-qa-brief` later for QA, revision packs, and replans against the same brief lineage
