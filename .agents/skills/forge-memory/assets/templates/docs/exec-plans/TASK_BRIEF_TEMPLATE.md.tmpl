# Task Brief Pack Contract

Use this file as the canonical contract for execution packs under `docs/exec-plans/active/<brief-id>/`.

## Brief ID

- Default format: `YYYY-MM-DD-<task-slug>`
- Keep one stable folder per task batch
- Record revisions as `v1`, `v2`, `v3` inside `01-brief-lineage-and-sources.md`

## Rules That Apply To Every Pack

- The coding agent starts from `README.md`
- Every pack must define scope, non-goals, reuse points, blockers, verification, and durable memory update rules
- Every handoff must separate `Read for context` from `Execute now`
- Every handoff must declare one read mode: `FULL_REHYDRATE`, `BRIEF_REHYDRATE`, or `HOT_RESUME`
- All brief artifacts, reports, and automation files stay inside the active repo path. In forge, a request for a new branch or worktree means a GitHub branch only; do not create `git worktree` directories, sibling clones, or duplicated repo folders.
- Every multi-phase pack must define the initial authorized execution window: one phase or one contiguous `AUTONOMOUS` block that ends before the next `QA_CHECKPOINT` or `FINAL_SHIPGATE`
- Later phases are context only until a new handoff prompt authorizes them
- `QA_CHECKPOINT` and `FINAL_SHIPGATE` are external review gates, not self-clear gates
- Every phase must declare its runtime validation level so rebuild and restart cost matches the real change
- Every QA stop writes a timestamped Markdown report under `reports/` and refreshes `reports/LATEST.md`
- Every stop report includes `Durable memory candidates`: concise facts that may need promotion into repo memory at final shipgate
- When repo-local automation is installed, every QA stop refreshes only the `reports/LATEST.json` fields needed to point at the newest stop report and record the current stop metadata truthfully
- Every `QA_CHECKPOINT`, `FINAL_SHIPGATE`, or blocker stop must leave the branch in a committed state and distinguish `implementation_commit_sha` from `stop_report_commit_sha` in its closeout metadata
- Push the active branch at every `QA_CHECKPOINT` and `FINAL_SHIPGATE` unless repo policy or the brief explicitly says otherwise
- Default git endpoint is commit and push on the active branch; do not infer merge-to-`main` or PR actions unless the user explicitly asked for them
- Repo-local Claude hooks may enforce stop-artifact truth and phase validation-level drift, so the brief must name the expected runtime path clearly
- Brief-local or reports-only drift that QA can verify directly should be repaired inline by QA instead of triggering a new revision pack
- When QA performs such an inline repair, `implementation_commit_sha` stays attached to the accepted implementation and any QA-authored repair commit becomes the new `stop_report_commit_sha`
- Worker checkpoints should run the smallest truthful delta suite for the files changed since the last green evidence
- QA should rerun independently at final shipgate, after high-risk deltas, or when worker evidence is untrustworthy instead of repeating identical suites at every stop
- Intermediate checkpoints use a lean continuity contract: pushed code state, one timestamped report, `reports/LATEST.md`, durable memory candidates, and required machine-readable state only when already in use
- Intermediate checkpoints do not update full durable repo memory unless the phase changed architecture, testing, deployment, runtime-contract, or durable product-state facts needed before final shipgate
- Final archive and memory closeout should normally be reported in one terminal shipgate summary, not fragmented into extra closeout reports
- Final clearance is not complete until the required memory updates are written and verified
- Final clearance is not complete until the accepted brief is archived from `active/` into `completed/` and that archived path is verified, unless the brief explicitly defines a different completed-path rule
- Keep accepted packs under `docs/exec-plans/completed/` and active work under `docs/exec-plans/active/`

## brief-lite

Use `brief-lite` when all are true:

- one coherent product surface
- one branch or worker
- no schema or migration change
- no new external integration
- no auth, security, or performance-sensitive seam
- no shared UI-system, navigation, or token work
- no multi-phase rollout is needed

Required files:

1. `README.md`
2. `00-coding-agent-prompt.md`
3. `01-brief-lineage-and-sources.md`
4. `10-phase-1-implementation.md`
5. `90-final-qa-and-merge-gate.md`
6. `99-memory-pack-update.md`
7. `reports/README.md`

For `brief-lite`, keep branch ownership and audit context inline in `README.md` or `01-brief-lineage-and-sources.md` when they are trivial.

## brief-full

Use `brief-full` when any are true:

- more than one major surface changes
- the task needs multiple phases or checkpointed autonomy
- schema, auth, security, performance, or integration risk exists
- branch coordination or serialized ownership handoffs are expected
- shared UI-system, navigation, or token work is involved
- a standalone branch plan or audit file is worth the extra structure

Required files:

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

## Execution Windows

- The initial worker handoff should authorize only the first phase or the first contiguous `AUTONOMOUS` block
- Do not authorize phases past the next `QA_CHECKPOINT` or `FINAL_SHIPGATE` in the same handoff
- When a phase clears, the next handoff may authorize the next window
- If the pack is truly one-shot and low risk, say so explicitly instead of leaving the worker to infer that the whole pack is authorized

## Machine-Readable Stop Artifacts

- `reports/LATEST.json` should mirror the newest stop report alongside `reports/LATEST.md`
- minimum fields: `brief_id`, `latest_report`, `updated_at`, `stop_status`, `implementation_commit_sha`, and `stop_report_commit_sha`
- when the repo uses repo-local Claude automation, `reports/LATEST.json` is part of the stop gate, but intermediate stops should update only the fields needed for truthful checkpoint continuity

## V3A Automation

- when the repo uses V3A automation, every brief should also keep `automation/state.json` and `automation/qa.json`
- `automation/state.json` is the machine-readable source of truth for the current authorized phase, execution status, `read_mode`, `validation_level`, `owned_paths`, explicitly allowed runtime commands, and target GitHub branch; keep `worktree` as `null`
- `automation/qa.json` is the machine-readable source of truth for the latest QA outcome, finding taxonomy, report path, verified SHAs, and next authorized phase
- the coding agent updates only the needed `automation/state.json` fields before every review-gate stop so the brief no longer claims stale `READY_FOR_IMPLEMENTATION`
- QA updates only the needed `automation/qa.json` and next `automation/state.json` authorization-window fields after every review outcome

## Read Modes

- `FULL_REHYDRATE`
  - use for a fresh session, a new GitHub branch, a new brief, or when stale-context risk is non-trivial
  - read `AGENTS.md`, `CLAUDE.md`, `docs/agent-memory/CURRENT_STATE.md`, `docs/agent-memory/TESTING.md`, brief `README.md`, `01-brief-lineage-and-sources.md`, and the current authorized phase file(s)
  - read additional repo-memory or UI docs only when the brief names them as authoritative or the current phase depends on them
- `BRIEF_REHYDRATE`
  - default for same-brief continuation after QA on the same repo path and GitHub branch
  - read brief `README.md`, the current authorized phase file(s), `reports/LATEST.md` when present, and `01-brief-lineage-and-sources.md` only if it changed or the handoff says to reread it
  - read `docs/agent-memory/TESTING.md` only when the phase needs commands from it or the commands changed
- `HOT_RESUME`
  - use only inside the same live coding session when branch, repo path, brief, and stop conditions have not materially changed
  - read the new handoff prompt, the current authorized phase file(s), and `reports/LATEST.md` only if it changed since the last stop
  - escalate to `BRIEF_REHYDRATE` immediately if the brief changed, QA revised the plan, or the agent is unsure about current constraints

Default:

- initial worker handoff for a new batch should normally use `FULL_REHYDRATE`
- next-phase handoffs on the same brief should normally use `BRIEF_REHYDRATE`
- treat brief `README.md`, the current authorized phase file(s), and `reports/LATEST.md` as the default same-brief continuation set
- escalate to a broader reread only when the branch or active repo target changed, the active brief changed materially, brief lineage changed materially, dirty state or topology changed, durable testing or architecture assumptions changed, or the smaller context set is no longer enough to execute or verify truthfully
- do not force full repo-memory rereads on every same-brief continuation unless the declared read mode or evidence requires it

## Required Behavior In Every Phase File

- declare `NO_RUNTIME_CHECK`, `LIVE_RELOAD`, `SERVICE_RESTART`, or `FULL_REBUILD`
- name the owned files when repo evidence confirms them; otherwise name owned modules or surfaces plus clearly labeled likely file candidates
- list files to change in order when repo evidence confirms them; otherwise name concrete modules or surfaces plus clearly labeled likely file candidates
- name the exact reuse points
- state what must not change
- state the required runtime evidence and why cheaper validation would be insufficient when using `FULL_REBUILD`
- list any explicitly allowed restart or rebuild commands when the phase uses `SERVICE_RESTART` or `FULL_REBUILD` and the repo has command-enforcement hooks
- when a single image-baked frontend or backend service needs a service-scoped rebuild or recreate to become live, keep it under `SERVICE_RESTART` only if the phase names that exact service-bound command family
- define repo-root-relative `owned_paths` when the repo uses V3A ownership hooks
- define tests and manual QA
- declare the gate to move forward, including whether external QA clearance is required before any later phase may start
- label the phase as `AUTONOMOUS`, `QA_CHECKPOINT`, or `FINAL_SHIPGATE`

## Validation Levels

- `NO_RUNTIME_CHECK`: use static analysis, diff review, or automated tests only
- `LIVE_RELOAD`: keep the stack running and refresh the browser; avoid rebuilds and restarts unless blocked
- `SERVICE_RESTART`: restart only the directly affected service or services; a service-scoped image rebuild or recreate is still acceptable when the phase explicitly names that command family for the affected service
- `FULL_REBUILD`: rebuild the affected image or stack because a runtime boundary changed

Use the cheapest truthful level for each phase. Do not default to `docker compose up --build` after every phase.
