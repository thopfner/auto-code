# Strict Brief Template

Use this template when preparing a coding-agent brief under `forge-qa-brief`.

This template is especially for QA-authored revision packs and replans after a failed implementation pass. The coding agent should receive a corrected execution pack, not a loose list of QA findings.

The brief must anchor to:

- the active repo memory pack
- the current brief lineage
- the actual target GitHub branch and active repo-path topology
- the active brief-local reporting path under `reports/`

## Brief ID And Versioning

- Default `BRIEF_ID`: `YYYY-MM-DD-<task-slug>`
- Keep one stable brief folder per task batch
- Record revisions as `v1`, `v2`, `v3` inside `01-brief-lineage-and-sources.md`

## Pack Selection

### Use `brief-lite` when

- one coherent surface is being changed
- one branch or worker is enough
- no schema or migration change is involved
- no new integration, auth, security, or performance-sensitive seam is involved
- no shared UI-system, navigation, or token work is involved
- no dedicated branch-plan or audit file is needed

### Use `brief-full` when

- the task spans multiple phases or major surfaces
- branch coordination or serialized ownership handoffs are expected
- schema, auth, security, performance, or integration risk exists
- the pack needs a standalone branch plan or audit file

## README.md

Required sections:

1. Title
2. Scope
3. Hard Rules
4. Execution Order
5. Phase Gates
6. Required Output From The Coding Agent
7. Definition Of Done
8. Brief Lineage Summary
9. Target GitHub Branch And Repo-Path Summary
10. Autonomy Model

Required content:

- what is in scope
- what is explicitly out of scope
- exact phase order
- explicit stop-gate language
- exact final commands to run if known
- explicit statement of what remains out of scope even if the coding agent sees tempting adjacent work
- the `Production-grade acceptance bar`, inherited from the source brief or re-established from repo conventions, primary-source research, or an explicit user-approved tradeoff
- the source brief folder or a statement that this is the first brief in the lineage
- the GitHub branch the execution should target and a statement that the active repo path remains the only filesystem target
- a clear statement that coding agents should start from `README.md`
- where the coding agent may continue autonomously and where it must stop for QA
- the rule that every QA stop must produce a report in `reports/` and refresh `reports/LATEST.md` so it truthfully points at the newest stop report
- when the repo uses machine-readable stop artifacts, the rule that every QA stop must refresh only the `reports/LATEST.json` fields needed to keep it aligned with `reports/LATEST.md` and the verified stop state
- when the repo uses V3A automation, the rule that every coding-agent stop must refresh only the `automation/state.json` fields needed to truthfully record current execution status and avoid stale `READY_FOR_IMPLEMENTATION`
- when the repo uses V3A automation, the rule that QA updates `automation/qa.json` and the next `automation/state.json` authorization window after each review outcome, limited to the fields needed for the next handoff
- the rule that `reports/LATEST.md` is the default delta source for same-brief continuation and repeated QA unless an escalation trigger requires broader rereading
- the rule that intermediate checkpoints use a lean continuity contract: pushed code, one timestamped report, `reports/LATEST.md`, and required machine-readable state only when already in use
- the rule that durable repo memory updates normally happen at final shipgate unless an intermediate phase changed architecture, testing, deployment, runtime-contract, or durable product-state facts needed before final shipgate
- the initial authorized execution window for the next handoff
- which later phases remain context only until a new handoff prompt
- the rule that `QA_CHECKPOINT` and `FINAL_SHIPGATE` require external review clearance before any later phase may start
- enough execution-order clarity that QA can determine and return the next authorized execution window automatically after an intermediate `CLEAR_CURRENT_PHASE`

## 00-coding-agent-prompt.md

Required sections:

1. Role
2. Required Read Order
3. Execution Rules
4. Anti-Drift Rules
5. Required Production-Grade Acceptance Bar
6. Required Reporting

Required content:

- preserve the source brief's production-grade acceptance bar in revision packs unless the user explicitly approved a lower temporary bar
- for replans, re-establish the production-grade acceptance bar from repo conventions, source scope or plan lineage, external primary-source research, or an explicit user-approved tradeoff
- use the compact worker handoff shape in `.agents/skills/references/worker-handoff-prompt-shape.md`
- tell the coding agent that the handoff must declare one read mode: `FULL_REHYDRATE`, `BRIEF_REHYDRATE`, or `HOT_RESUME`
- tell the coding agent to follow the chosen read mode and exact read list instead of mentioning or invoking `$auto-forge-bootstrap` by name for normal phase execution
- tell the coding agent that `FULL_REHYDRATE` is for fresh sessions, new GitHub branches, new briefs, or meaningful stale-context risk
- tell the coding agent that `BRIEF_REHYDRATE` is the default for same-brief continuation after QA on the same repo path and GitHub branch
- tell the coding agent that `HOT_RESUME` is only for the same live coding session when branch, repo path, brief, and stop conditions are materially unchanged
- tell the coding agent that `FULL_REHYDRATE` should read `AGENTS.md`, `CLAUDE.md`, `docs/agent-memory/CURRENT_STATE.md`, `docs/agent-memory/TESTING.md`, brief `README.md`, `01-brief-lineage-and-sources.md`, and the current authorized phase file(s)
- tell the coding agent that `BRIEF_REHYDRATE` should usually read brief `README.md`, the current authorized phase file(s), `reports/LATEST.md`, and reread `01-brief-lineage-and-sources.md` only when it changed or the handoff says to
- tell the coding agent that `HOT_RESUME` should usually read only the new handoff prompt, the current authorized phase file(s), and any changed `reports/LATEST.md`
- tell the coding agent to use the lightest truthful read mode instead of rereading full repo memory on every same-brief continuation
- tell the coding agent to treat brief `README.md`, the current authorized phase file(s), and `reports/LATEST.md` as the default same-brief continuation set
- tell the coding agent to escalate to a broader reread only when the branch or active repo target changed, the active brief changed materially, brief lineage changed materially, dirty state or topology changed, durable architecture or testing rules changed, or the smaller context set is no longer enough to execute or verify truthfully
- tell the coding agent to follow the phase `validation_level` and to escalate only if a cheaper validation path cannot produce truthful evidence
- tell the coding agent to stop if a gate fails
- tell the coding agent to stop automatically at every `QA_CHECKPOINT` and `FINAL_SHIPGATE`
- tell the coding agent that `QA_CHECKPOINT` and `FINAL_SHIPGATE` are external approval gates and may not be self-cleared
- tell the coding agent not to start later phases until a new handoff prompt authorizes them
- tell the coding agent to reuse existing logic where specified
- tell the coding agent not to invent new architecture unless the brief explicitly allows it
- tell the coding agent to update required memory docs before claiming completion only when the phase explicitly requires it; otherwise durable memory closeout is final-shipgate work
- tell the coding agent to write a timestamped Markdown stop report into `reports/` and update `reports/LATEST.md` before waiting for QA, and to make that report body name the exact `implementation_commit_sha`
- tell the coding agent that when the repo uses machine-readable stop artifacts, it must also refresh only the `reports/LATEST.json` fields needed to point at the newest stop report and record `updated_at`, `stop_status`, `implementation_commit_sha`, and `stop_report_commit_sha` truthfully
- tell the coding agent that when the repo uses V3A automation, it must refresh only the `automation/state.json` fields needed before stopping so the brief no longer claims stale `READY_FOR_IMPLEMENTATION`
- tell the coding agent that in V3A repos, only files under the current phase `owned_paths` plus the active brief's `reports/` and `automation/` folders are editable without a QA-authored reauthorization
- tell the coding agent that if the phase changed tracked code or docs, it must create or identify the `implementation_commit_sha` before writing the stop report
- tell the coding agent to create the checkpoint or report commit after the stop report files are written, then push, and to report branch name, `implementation_commit_sha`, `stop_report_commit_sha`, and push status distinctly
- tell the coding agent to push at review gates unless repo policy or the brief explicitly says otherwise

## 01-brief-lineage-and-sources.md

Required sections:

1. Source brief
2. Current phase
3. Compare base and target
4. Authoritative repo memory files
5. What changed from the previous brief
6. Stop condition if source assumptions break

Required content:

- exact prior brief path when one exists
- exact current phase or QA stop being addressed
- branch or compare range when known, plus confirmation that the repo path did not change
- the specific memory files the coding agent must treat as authoritative
- what was revised or superseded from the previous brief
- when this is a revision or replan pack, identify the blocking QA findings the new pack resolves

## 02-branch-and-worktree-plan.md

Required for `brief-full`. Optional for `brief-lite` when ownership is trivial enough to summarize in `README.md` or `01-brief-lineage-and-sources.md`.

Keep this legacy filename for compatibility, but use it to document branch ownership and confirm that no duplicate repo path is authorized.

Required sections:

1. Lead GitHub branch
2. Worker ownership
3. Integration order
4. File-collision stop rules
5. Branch hygiene rules

Required content:

- exact branch names when known
- owned files or modules per worker
- one owner for every shared surface
- explicit stop rules if two workers need the same file
- who owns final integration and merge or rebase
- checkpoint commit and push expectations when the repo wants stricter hygiene per branch
- an explicit statement that `git worktree` directories and duplicate repo folders are not authorized and that `automation/state.json`.`worktree` stays `null`

For single-branch small tasks, this file may be short, but it should still state ownership and integration rules.

## 03-root-cause-or-audit.md

Required for `brief-full`. Optional for `brief-lite` when the reasoning can stay short and live in `README.md` or `01-brief-lineage-and-sources.md`.

Required sections:

1. Issue list
2. Why each issue exists
3. Required direction
4. Files expected to change
5. Evidence checked
6. Stop condition if assumptions break

Required content:

- separate “what is missing” from “why it is missing”
- identify the exact existing workflows that should be reused
- name the risky or conditional areas explicitly
- name exact files only when QA can confirm them from repo evidence; otherwise name concrete modules or surfaces and clearly label likely file candidates as likely rather than fixed
- describe which evidence was checked in QA mode such as diff, test output, logs, or functional runtime behavior
- for revision or replan packs, map each blocking QA finding to the exact directive that resolves it
- do not leave the coding agent to infer the fix from findings alone

## Validation Levels

- `NO_RUNTIME_CHECK`: use static analysis, diff review, or automated tests only
- `LIVE_RELOAD`: use the already-running stack and refresh the served app when needed; do not rebuild or restart unless the runtime proves stale or blocked
- `SERVICE_RESTART`: restart only the directly affected service or services; a service-scoped image rebuild or recreate is still acceptable when that exact command family is explicitly authorized for the affected service
- `FULL_REBUILD`: rebuild the affected image or stack because a runtime boundary changed and cheaper validation would not be truthful

Use the cheapest truthful validation level for each phase. Every `FULL_REBUILD` must say why cheaper validation is insufficient.
In `LIVE_RELOAD`, any rebuild or restart must say why live reload was not truthful enough.

## automation/state.json

Use when the repo uses V3A automation.

Required fields:

1. `brief_id`
2. `authorized_phase`
3. `status`
4. `read_mode`
5. `validation_level`
6. `owned_paths`
7. `allowed_commands`
8. `branch`
9. `worktree`
10. `updated_at`

Required characteristics:

- `status` is one of `READY_FOR_IMPLEMENTATION`, `WAITING_FOR_QA`, `BLOCKED_EXTERNAL`, or `CLEARED`
- `authorized_phase` points at the exact currently authorized phase file
- `owned_paths` are repo-root-relative globs or paths for files the coding agent may edit in the current authorization window
- `allowed_commands` names any runtime-changing Bash commands that are explicitly allowed despite hook enforcement
- when `allowed_commands` includes a service-scoped `docker compose build`, `docker compose up`, or `docker compose restart` command, repo-local hooks may treat that command family as equivalent for the same targeted service set
- keep `worktree` as `null` in forge workflows; the active repo path remains the only execution target
- the coding agent flips `status` away from `READY_FOR_IMPLEMENTATION` before stopping at a review gate or blocker stop
- QA updates the file again when it authorizes the next phase or clears the brief

## automation/qa.json

Use when the repo uses V3A automation.

Required fields:

1. `brief_id`
2. `qa_status`
3. `last_reviewed_phase`
4. `next_authorized_phase`
5. `latest_report`
6. `implementation_commit_sha`
7. `stop_report_commit_sha`
8. `finding_types`
9. `updated_at`

Required characteristics:

- `qa_status` is one of `NOT_REVIEWED`, `CLEAR_CURRENT_PHASE`, `REVISION_PACK_REQUIRED`, `REPLAN_REQUIRED`, or `BLOCKED_EXTERNAL`
- `finding_types` is an array of any applicable `plan_gap`, `execution_miss`, and `validation_only` labels
- QA updates this file on every blocking or clearing outcome

## Phase File

Required sections:

1. Phase title
2. Execution mode
3. Validation level
4. Goal
5. Owned files or modules
6. Files to change, in order
7. Source workflows or files to reuse
8. Step-by-step implementation
9. Required behavior
10. What must not change in the phase
11. Required runtime evidence
12. Required tests for the phase
13. Required durable memory updates on success, if any before final shipgate
14. Gate for moving forward

Required characteristics:

- steps must be executable
- file order must be explicit when QA can confirm the files from repo evidence
- use exact files only when QA can confirm them from repo evidence; otherwise name concrete modules or surfaces and clearly label likely file candidates instead of turning guesses into fixed requirements
- avoid broad verbs like “improve” without saying how
- state what must not be changed in the phase
- name the existing file or workflow to copy behavior from when relevant
- make blocker conditions explicit
- keep one phase focused on one coherent product surface when possible
- keep ownership explicit if the phase is assigned to a specific worker or branch
- label the phase as `AUTONOMOUS`, `QA_CHECKPOINT`, or `FINAL_SHIPGATE`
- choose the cheapest truthful validation level for the phase
- justify any `FULL_REBUILD`
- use `QA_CHECKPOINT` after meaningful risk boundaries instead of defaulting to one-shot execution across all phases
- make every `QA_CHECKPOINT` and `FINAL_SHIPGATE` gate explicitly require external review clearance before later phases may begin
- name the smallest truthful delta suite for worker checkpoints
- name any final acceptance suite that QA should rerun independently at shipgate
- say when prior green evidence may be reused because no relevant code or runtime delta occurred
- avoid adjacent same-surface `QA_CHECKPOINT` phases unless separate regression seams justify them
- keep intermediate checkpoints lean: pushed implementation state, one stop report, `reports/LATEST.md`, and required machine-readable state only when already in use
- require durable repo memory updates in an intermediate phase only when later phases or fresh sessions need the new fact before final shipgate

The first phase file, usually `10-phase-1-implementation.md`, is required in every pack. Additional phase files are required only when the pack is multi-phase.

## 90-final-qa-and-merge-gate.md

Despite the filename, this gate does not imply that the agent should choose or propose a merge strategy by default. The default endpoint is a verified commit and push on the active branch. Merge-to-`main`, PR creation, or other landing actions happen only when the user explicitly requests them.

Required sections:

1. Automated checks
2. Manual QA
3. Required runtime validation proof
4. Required test additions
5. Completion report required from the coding agent
6. Compare-against-brief gate
7. Explicit non-goals
8. Final stop gate
9. QA stop status options

Required content:

- exact commands to run when known
- phase-by-phase functional QA scenarios
- the required final runtime validation level and why it is sufficient
- when the batch includes user-visible frontend changes, the exact runtime action required for those changes to become visible in the real served frontend; do not leave final shipgate at `LIVE_RELOAD` when the frontend requires rebuild, recreate, or deploy work to become truthful
- criteria that disallow claiming completion
- a requirement to compare claimed files changed and tests run against actual evidence
- a requirement to compare claimed branch name, `implementation_commit_sha`, `stop_report_commit_sha`, and push state against actual git evidence
- a requirement that the coding agent writes its completion report into `reports/` and refreshes `reports/LATEST.md`
- a requirement that when the repo uses machine-readable stop artifacts, the coding agent also refreshes `reports/LATEST.json`
- a requirement that when the repo uses V3A automation, QA also verifies and updates `automation/state.json` and `automation/qa.json`
- a requirement that when an intermediate phase clears and later phases remain, QA returns the next authorized worker handoff prompt automatically
- a requirement that final QA executes and verifies the memory-pack updates before returning `CLEAR_CURRENT_PHASE`
- a requirement that final QA reconciles updated memory docs, final reports, `reports/LATEST.*`, `automation/*.json`, current branch, and `HEAD` before returning `CLEAR_CURRENT_PHASE`
- a requirement that final QA commits and pushes QA-owned final closeout changes, including memory updates, final reports, `reports/LATEST.*`, `automation/*.json`, and the active-to-completed brief archive move, without asking the user when those changes are within the accepted brief scope
- a requirement that the pushed branch contains the final closeout `HEAD`
- a requirement that final QA verifies `git status --short` is clean before returning `CLEAR_CURRENT_PHASE`
- a requirement that final QA does not silently commit unrelated dirty files, and blocks or reports limited closeout if unrelated pre-existing dirty state remains
- a requirement that every recorded implementation, stop-report, checkpoint, phase-closeout, and final closeout commit ID is a full 40-character SHA that resolves to the exact intended commit in live git
- a requirement that when docs or automation closeout commits advance `HEAD` after accepted runtime code, QA distinguishes accepted `implementation_commit_sha` from `stop_report_commit_sha` and final closeout `HEAD`
- a requirement that final QA proactively returns the verified completed-brief path and verified updated memory-file paths without waiting for a separate closeout request
- a requirement that final QA archives the accepted brief out of `active/` by default and does not tell the user to do that archival manually
- a requirement that final QA defaults to commit-and-push on the active branch and does not ask the user to choose between direct merge and PR flow
- a requirement that no merge-to-`main`, rebase onto `main`, or PR creation occurs unless the user explicitly asked for that action
- a requirement that brief-local or report-local drift under the active brief, `reports/`, or required memory-closeout docs is repaired inline by QA when no app code, tests, runtime behavior, or worker-owned implementation files need to change
- a requirement that inline QA repairs keep `implementation_commit_sha` attached to the accepted implementation and use any QA-authored repair commit as the new `stop_report_commit_sha`
- a requirement that QA reruns independently at final shipgate, after high-risk deltas, or when worker evidence is untrustworthy, rather than automatically repeating identical suites at every stop
- a requirement that docs-only QA repairs do not rerun code tests, builds, or deploy steps unless the prior evidence itself is untrustworthy
- a requirement that final archive and memory closeout live in one terminal shipgate summary unless closeout itself becomes blocked
- the allowed final QA stop statuses:
  - `CLEAR_CURRENT_PHASE`
  - `REVISION_PACK_REQUIRED`
  - `REPLAN_REQUIRED`
  - `BLOCKED_EXTERNAL`

## reports/README.md

Required content:

- the purpose of the `reports/` folder
- the rule that each `QA_CHECKPOINT`, `FINAL_SHIPGATE`, or blocker stop writes one timestamped Markdown report
- the rule that `reports/LATEST.md` must truthfully point at the newest stop report and stay reliable as the same-brief delta summary
- when the repo uses machine-readable stop artifacts, the rule that `reports/LATEST.json` must point at the same newest stop report and record its update time and commit identifiers truthfully, without becoming a broad documentation chore at intermediate checkpoints
- the rule that commit IDs in reports and machine-readable artifacts must be full 40-character SHAs, not short SHAs
- the rule that report and memory closeout text must distinguish the accepted runtime implementation commit from later docs, reports, automation, or archive commits
- when the repo uses V3A automation, the rule that `automation/state.json` must reflect the current authorized phase and execution status truthfully and `automation/qa.json` must reflect the latest QA outcome truthfully, limited to the fields needed for checkpoint continuity until final closeout
- the rule that one stop should normally produce one terminal report, not separate archive, memory, and shipgate reports for the same closeout
- a filename pattern such as `YYYY-MM-DDTHH-MM-SSZ-phase-<n>-<status>.md`
- the minimum report contents:
  - phase addressed
  - stop status
  - summary
  - branch and confirmation that the repo path stayed unchanged
  - implementation_commit_sha
  - push status
  - files changed
  - tests run
  - reused prior green evidence, when applicable
  - functional QA performed
  - blockers or residual risks
  - durable memory candidates: concise facts from this stop that may need promotion to `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `DECISIONS.md`, `TESTING.md`, or other repo memory at final shipgate

Required closeout metadata outside the report body:

- exact `stop_report_commit_sha` for the pushed branch HEAD after the checkpoint or report commit
- QA should validate this against live git state instead of expecting the committed report to self-embed the SHA of the commit that contains it
- if QA repaired only brief-local drift inline, the accepted `implementation_commit_sha` should remain the implementation commit and the QA-authored repair commit should become the reported `stop_report_commit_sha`

## 99-memory-pack-update.md

Required sections:

1. Files to update
2. Exact facts to record
3. Sections to edit
4. Active-to-completed brief move rules
5. Stop condition if memory would become misleading

Required content:

- whether `CURRENT_STATE.md` must change
- whether `SESSION_HANDOFF.md` must change
- whether `DECISIONS.md` must change
- whether `TESTING.md` must change
- whether `PARALLEL_RULES.md` must change
- what must happen to the active brief when the phase is accepted
- that final QA is responsible for executing and verifying these updates on the VPS before final clearance
- that final QA must verify all commit references written into memory against live git and use full 40-character SHAs
- that final QA must distinguish accepted implementation commit, report/checkpoint commit, and final docs or automation closeout `HEAD` when they differ
- that final QA should report the verified updated-memory paths and completed-brief path automatically after closeout
- that accepted briefs should be archived from `docs/exec-plans/active/` into `docs/exec-plans/completed/` by the agent during closeout unless the brief explicitly overrides that path

## Language Rules

Use:

- direct commands
- “do not proceed until...”
- “if this fails, stop and fix...”
- “stop and report if...”
- “reuse the behavior from...”
- “keep behavior identical to...”
- “files to change, in order”
- “owned files”
- “required repo memory updates”
- “gate”

Avoid:

- high-level product prose as the main content
- generic design commentary
- optional language unless clearly marked optional
- broad verbs without acceptance criteria
- mixed required and optional work in the same numbered sequence
- silent changes to branch ownership or brief lineage
