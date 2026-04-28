---
name: auto-forge-qa-brief
description: Audit a remote server-hosted codebase over SSH, rehydrate from AGENTS.md, CLAUDE.md, docs/agent-memory, and active execution briefs, perform QA against the live implementation and brief lineage, and produce strict action-oriented revision packs or replans delivered back to the host via SCP. Use when the user wants QA, phase clearance, revision packs, or replan after implementation on a VPS-hosted repo, especially for repeated QA stops and serialized branch handoffs inside a single active repo path.
---

# Remote QA Implementation Brief

## Overview

Inspect a remote codebase over SSH, rebuild context from the repository itself, then either:

1. review the current implementation against the active brief and repo memory, or
2. prepare a strict execution runbook for a separate coding agent

Deliver planning artifacts as Markdown bundles and copy them to the remote host via SCP.

Open [references/strict-brief-template.md](references/strict-brief-template.md) when drafting a plan bundle.

This skill is the QA and handoff layer that sits between:

- repo memory maintenance via [$auto-forge-memory](.agents/skills/forge-memory/SKILL.md)
- fresh-session rehydration via [$auto-forge-bootstrap](.agents/skills/forge-bootstrap/SKILL.md)
- remote execution by Claude CLI, Codex CLI, or another code-writing agent

Default role split in this workflow:

- [$auto-forge-plan](.agents/skills/forge-plan/SKILL.md): initial feature planning and first-pack delivery from Codex Local
- `forge-qa-brief`: QA review, phase clearance, and authorship plus delivery of revision packs or replans against an existing brief lineage

Primary objective of this skill:

- maximize coding-agent execution accuracy
- minimize drift from the intended plan
- force explicit QA stops and phase gates
- preserve brief lineage across revisions
- support serialized branch handoffs and file ownership discipline without repo-path collisions

## Remote Topology Guardrail

- Treat the active VPS repo path as the only allowed filesystem root for QA, replans, and revision packs.
- When the user asks for a new branch or worktree, interpret that as a GitHub branch request only. Do not create `git worktree` directories, sibling clones, or duplicated repo folders.
- Keep QA-authored briefs, reports, and automation files inside the active repo path.

## Workflow

### 1. Confirm the operating target

Establish:

- SSH host
- repo path on the host
- whether the task is `QA`, `revision planning`, or `replan`
- remote destination folder for the brief
- active brief folder or phase being reviewed or revised
- target GitHub branch, plus the compare range if QA is against an implementation branch

If the user already provided these, do not ask again. If one is missing and cannot be inferred safely, ask only for that missing value.

If the user does not specify a destination folder, default to a repo-local path under `docs/exec-plans/active/<brief-id>/`.
Never choose or create a destination outside the active repo path.

### 2. Rehydrate from repo memory before planning or QA

Before reviewing code or drafting a brief, read the repository memory in this order when present:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/agent-memory/PROJECT.md`
4. `docs/agent-memory/ARCHITECTURE.md`
5. `docs/agent-memory/DECISIONS.md`
6. `docs/agent-memory/CURRENT_STATE.md`
7. `docs/agent-memory/TESTING.md`
8. `docs/agent-memory/SESSION_HANDOFF.md`
9. `docs/agent-memory/PARALLEL_RULES.md` when multiple workers or branch-ownership handoffs are involved
10. the active brief under `docs/exec-plans/active/`
11. the latest related completed brief if the current task is a revision or next phase

If these files are missing in a project that is expected to support repeated QA and handoff cycles:

- treat that as a process gap
- call it out explicitly in the review or plan
- use [$auto-forge-memory](.agents/skills/forge-memory/SKILL.md) to initialize or repair the memory pack when the user wants persistent workflow hygiene

Do not trust old chat history over the repo memory pack and live code.

If the same repo path, GitHub branch, `HEAD`, `git status --short`, and active brief folder are already confirmed in the current session, you may abbreviate rehydration to changed files, the latest report, and any memory docs implicated by the current QA stop.

Use layered QA rehydration:

- full QA rehydrate when the QA session is fresh, the branch or active repo target changed, the active brief changed materially, the brief lineage changed materially, dirty state or topology changed, or durable architecture, testing, UI-system, or runtime-contract assumptions changed
- delta QA rehydrate for same-brief continuation on the same repo path and GitHub branch:
  - active brief `README.md`
  - the current reviewed phase file(s)
  - `reports/LATEST.md` when present, otherwise the newest timestamped report
  - `01-brief-lineage-and-sources.md` only when it exists and changed, or when the stop cannot be understood without it
  - only the repo-memory docs implicated by the current stop, findings, or validation commands

Do not reread the full memory pack on every same-brief QA pass when the active brief plus the latest report already captures the delta truthfully.

### 3. Inspect the live repo over SSH before planning

Always start by inspecting the remote checkout directly.

Minimum first pass:

- `git status --short`
- `git branch --show-current`
- `git worktree list` only when you need to detect unexpected duplicate checkouts or verify a user-provided topology; never use it as a cue to create more worktrees
- locate relevant files with `rg` or fallback `grep`
- read the entrypoints and the specific feature surfaces involved
- inspect schema, migrations, loaders, or contracts when the feature is data-backed
- compare the implementation branch against the expected base when QA is phase-based

Do not draft a plan before understanding:

- renderer path
- admin or editor path
- persistence path
- important invariants and non-goals
- which repo memory docs are authoritative for the task

Also confirm:

- whether the active repo path is dirty
- whether the requested feature already has a partial implementation
- which existing workflows already solve part of the problem and should be reused
- whether there are tests already covering the feature area
- whether the branch or repo-path topology violates `PARALLEL_RULES.md`
- whether the worker’s claimed changed files and tests match the actual repo state

### 4. Choose the correct mode

#### QA mode

Use when the user asks for:

- QA
- audit
- review
- grading
- regression check
- elite SaaS UX assessment
- phase clearance
- validation of implementation against the brief

In QA mode:

- review the implementation against the active brief, repo memory, live code, and evidence
- run targeted tests and build checks where appropriate
- default core QA to functional, runtime, test, diff, and artifact evidence; the user owns final UI polish acceptance unless the active brief explicitly says otherwise
- verify the worker followed the phase `validation_level`; do not demand full rebuild evidence when the brief only required `NO_RUNTIME_CHECK`, `LIVE_RELOAD`, or `SERVICE_RESTART`
- reuse prior green worker evidence when there is no relevant code or runtime delta since the last green stop for the same phase
- rerun independently only when:
  - final shipgate requires the acceptance suite
  - a high-risk seam changed after the last green evidence
  - the worker evidence is missing, stale, contradictory, or otherwise untrustworthy
  - QA explicitly changed or demanded new code, tests, or runtime behavior after the last green evidence
- in `LIVE_RELOAD`, treat rebuilds or restarts as exceptions that require explicit justification
- in `SERVICE_RESTART`, accept service-scoped rebuild or recreate evidence when the phase explicitly named that service-bound command family and no broader stack rebuild was required
- look for the worker stop report inside the active brief folder first:
  - use `reports/LATEST.md` when present
  - otherwise use the newest timestamped report under `reports/`
  - if no report exists, call that out as a process gap and continue from git state and other evidence when possible
- when the brief or repo uses machine-readable stop artifacts, load `reports/LATEST.json` too and verify it points at the same newest stop report truthfully
- when the brief or repo uses V3A automation, also load `automation/state.json` and `automation/qa.json` and verify they agree with the active phase, current QA outcome, and next authorized execution window
- verify machine-readable closeout hygiene, not just human-readable reports:
  - JSON SHAs should use full 40-character commit IDs
  - memory, report, and automation docs should not rely on short, ambiguous, or stale commit IDs
  - every recorded `implementation_commit_sha`, `stop_report_commit_sha`, final checkpoint commit, and phase-closeout commit should resolve with `git rev-parse <sha>^{commit}` to the exact full 40-character commit the doc claims
  - if a docs-only QA closeout commit advances `HEAD` after the accepted runtime implementation, keep `implementation_commit_sha` attached to the accepted runtime code and identify the docs or automation closeout commit separately as `stop_report_commit_sha` or closeout `HEAD`
  - cleared archived briefs should not keep `authorized_phase` populated
  - archived machine-readable paths must point at the archived brief location rather than stale `active/` paths
- treat `reports/LATEST.md` as the default same-brief QA delta source and pull broader memory or brief context only when an escalation trigger requires it
- verify the worker’s completion report against actual changed files, branches, and test output
- classify brief-local drift separately from implementation drift:
  - brief-local drift includes active-brief reports, `reports/LATEST.md`, brief lineage or phase-status files, and required memory-closeout metadata that QA can verify directly from git and accepted evidence
  - implementation drift includes app code, test code, runtime behavior, data behavior, or any tracked change that the coding agent must materially redo
- classify every confirmed non-brief-local finding as one or more of:
  - `plan_gap`:
    - the current phase brief was underspecified, too wide, or left the relevant seam ambiguous
  - `execution_miss`:
    - the current phase brief already made the missed behavior explicit and the implementation still failed to satisfy it
  - `validation_only`:
    - the implementation may be correct, but the required runtime proof, deploy step, live evidence, or stop artifact is missing, stale, or untruthful
- for every blocking finding, state whether the current phase brief already made that behavior explicit, with a brief citation when practical
- findings come first, ordered by severity
- separate confirmed issues from limitations
- end with one explicit QA stop status:
  - `CLEAR_CURRENT_PHASE`
  - `REVISION_PACK_REQUIRED`
  - `REPLAN_REQUIRED`
  - `BLOCKED_EXTERNAL`

If the current QA pass clears an intermediate phase but the implementation pack still has later phases:

- update the active brief lineage or phase status inside the brief folder
- refresh `reports/LATEST.md` so the newest stop state reflects the QA clearance before the next handoff
- when the brief uses machine-readable stop artifacts, refresh `reports/LATEST.json` only with the fields needed to keep it aligned with `reports/LATEST.md`, the reviewed phase, verified SHAs, and the next stop state
- when the brief uses V3A automation, update `automation/qa.json` and the next `automation/state.json` authorization window only as much as needed to authorize the next phase truthfully
- do not require full durable repo-memory closure unless the brief explicitly says this phase changed architecture, testing, deployment, runtime-contract, or durable product-state facts that later phases or fresh sessions need before final shipgate
- treat the intermediate checkpoint continuity anchor as the pushed code state plus one authoritative latest stop summary, not a full memory closeout
- keep the brief under `docs/exec-plans/active/`
- unless the user explicitly asks to stop, prepare the next authorized execution window automatically
- return the next handoff prompt automatically with:
  - the cleared phase
  - the verified active brief folder path
  - the verified branch name and `stop_report_commit_sha` when known
  - the next authorized phase or contiguous `AUTONOMOUS` block
  - the full paste-ready worker launch prompt for that next window, rendered inline in the response body rather than replaced by file paths only

If the current QA pass clears the final shipgate for the implementation pack:

- automatically execute the required actions from `99-memory-pack-update.md`
- write the resulting memory updates to the VPS repo
- verify the updated memory files on the VPS
- archive the accepted brief out of `docs/exec-plans/active/` into `docs/exec-plans/completed/` unless the brief explicitly defines a different completed-path rule
- verify the archived brief folder on the VPS
- update `automation/qa.json` with the final accepted QA outcome and set `automation/state.json` to `CLEARED`
- set `automation/state.json.authorized_phase` to `null` after archive clearance
- run a final memory-plus-git reconciliation before declaring closeout complete:
  - verify `git status --short`, current branch, and full `HEAD`
  - verify every commit SHA written into updated memory docs, final reports, `reports/LATEST.*`, and `automation/*.json`
  - expand or repair short SHAs and stale SHA references inline when the correction is docs-only
  - commit and push QA-owned final closeout changes, including memory updates, final reports, `reports/LATEST.*`, `automation/*.json`, and the active-to-completed brief archive move, without asking the user when those changes are within the accepted brief scope
  - verify the pushed branch contains the final closeout `HEAD`
  - verify `git status --short` is clean after the final closeout push
  - if dirty state remains after final closeout, do not return `CLEAR_CURRENT_PHASE` unless every remaining path is explicitly documented as pre-existing, unrelated, and intentionally out of scope; never silently commit unrelated dirty files
  - make the final summary distinguish accepted implementation commit, stop/report commit, and final docs/automation closeout `HEAD` when they differ
- unless the user explicitly asks to stop, do not ask whether to perform final closeout or memory updates
- do not tell the user to archive the brief manually later
- return the final closeout summary automatically with:
  - the verified completed brief folder path
  - the verified updated repo-memory file paths
  - the accepted branch name and `stop_report_commit_sha` when known
  - a short statement of what durable repo memory changed
- only then return `CLEAR_CURRENT_PHASE`

Final memory closeout should not stop at `CURRENT_STATE.md` and `SESSION_HANDOFF.md` by habit alone. Confirm whether `PROJECT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, and `TESTING.md` changed materially; if not, say so explicitly in the closeout.

If the only blocking findings are brief-local or report-local drift and no app code, tests, runtime behavior, or worker-owned implementation files need to change:

- do not emit `REVISION_PACK_REQUIRED` just to fix the brief
- repair the affected brief-local artifacts inline in the same QA run
- update and verify the affected report, `reports/LATEST.md`, lineage or phase-status files, `automation/*.json`, or required memory-closeout docs directly
- treat stale, short, ambiguous, or mismatched commit references in brief-local reports or memory-closeout docs as repairable brief-local drift when the accepted implementation itself is unchanged
- if the inline repair changes tracked files on the active branch, commit and push that repair directly as QA-owned closeout hygiene
- keep the accepted `implementation_commit_sha` anchored to the implementation that actually passed
- treat the pushed QA repair commit as the new `stop_report_commit_sha` when one is created
- do not rerun code tests, builds, or runtime deployment commands for that docs-only repair unless the prior evidence itself is not trustworthy
- continue the same QA pass after the repair instead of spawning a new revision pack

If QA fails but the plan is still correct:

- use `REVISION_PACK_REQUIRED` only when the coding agent must change app code, tests, runtime behavior, or other worker-owned tracked implementation state that QA should not repair inline
- do not use `REVISION_PACK_REQUIRED` for brief-local report, lineage, or memory-closeout drift that QA can verify and correct itself
- if the blocking findings are `validation_only` and no code or brief change is required, prefer the narrowest truthful restop or runtime-validation window instead of a broader code revision
- if a `plan_gap` materially contributed to the miss, the next revision pack must tighten the contract, split the risky phase, or add the missing seam inventory; do not merely restate the symptom
- if the findings are pure `execution_miss`, keep the revision pack narrow and preserve the cleared parts of the existing plan
- preserve the source brief's `Production-grade acceptance bar` in every revision pack unless the user explicitly approved a lower temporary bar
- the QA agent must author the revision pack for the current phase itself
- the revision pack must explicitly address each blocking QA finding that prevented clearance
- do not ask the coding agent to infer the fix from QA findings alone
- unless the user explicitly asks to stop, immediately transition from QA into revision-pack delivery:
  - write the pack locally
  - SCP it to the VPS brief folder
  - verify the remote files
  - update `automation/qa.json` with the blocking outcome and set `automation/state.json` to the newly authorized revision phase before returning the worker handoff
  - return the next handoff prompt automatically, including the full paste-ready prompt inline in the response body rather than only listing file paths
- end the review with `REVISION_PACK_REQUIRED`

If the plan itself is invalidated by code reality, schema truth, or changed constraints:

- the QA agent must author the corrected replan pack itself
- `REPLAN_REQUIRED` means the existing plan is no longer trustworthy, not that the coding agent should redesign the fix
- the replan pack must explicitly replace or supersede the invalid parts of the prior brief
- the replan pack must re-establish the `Production-grade acceptance bar` from repo conventions, source scope or plan lineage, external primary-source research, or an explicit user-approved tradeoff
- unless the user explicitly asks to stop, immediately transition from QA into replan-pack delivery:
  - write the pack locally
  - SCP it to the VPS brief folder
  - verify the remote files
  - update `automation/qa.json` with the blocking outcome and set `automation/state.json` to the newly authorized replan phase before returning the worker handoff
  - return the next handoff prompt automatically, including the full paste-ready prompt inline in the response body rather than only listing file paths
- end the review with `REPLAN_REQUIRED`

#### Planning mode

For brand-new feature planning with no brief lineage yet, prefer [$auto-forge-plan](.agents/skills/forge-plan/SKILL.md).

Within this skill, planning mode is also the execution path the QA agent uses immediately after a failed QA pass when it must author and deliver the next revision or replan pack.

Use when the user asks for:

- a plan
- a brief
- execution instructions for a coding agent
- rollout phases for a feature
- a fix package after QA
- a revision pack for the current phase

In planning mode:

- do not write vague strategy notes
- produce a strict action-oriented runbook
- include repo-grounded implementation targets, explicit order, gates, and completion criteria
- anchor the brief to the repo memory pack and brief lineage
- state branch ownership and repo-path constraints explicitly when serialized branch ownership handoffs are in play

### 5. Enforce strict implementation-brief standards

Every plan delivered under this skill must be coding-agent ready.

Required qualities:

- explicit scope
- explicit non-goals
- exact file touchpoints
- exact implementation order
- exact reuse points from the current codebase
- lean brief shape for low-risk work; enhanced contract detail only for phases that touch risky seams
- hard stop-gates after each phase
- required tests and functional QA
- required completion report from the coding agent
- required report-file contract inside the active brief folder
- required `reports/LATEST.json` truth contract when the repo uses machine-readable stop artifacts
- required `automation/state.json` and `automation/qa.json` truth contract when the repo uses V3A automation
- explicit “what must not change”
- explicit blocker conditions
- explicit acceptance criteria for each product surface
- explicit production-grade acceptance bar inherited from the source brief or re-established from repo conventions, primary-source research, or an explicit user-approved tradeoff
- explicit runtime `validation_level` per phase
- explicit required runtime evidence per phase
- validation commands that actually match the declared `validation_level`, because repo-local automation may enforce that contract during coding
- explicit source brief lineage and current phase
- explicit repo memory files that are authoritative for the task
- explicit branch ownership and repo-path constraints when parallel execution is involved
- explicit durable memory updates required at final shipgate, plus any narrowly required intermediate memory update when later phases or fresh sessions need a new durable fact before final shipgate
- explicit distinction between intermediate phase closure and final shipgate closure

Avoid:

- generic advice
- optional language as the main guidance
- broad brainstorming
- “consider” or “explore” without a concrete action path

Optional ideas are acceptable only after the required path is complete and clearly labeled as optional.

### 6. Optimize for coding-agent effectiveness

Every handoff package must be written to reduce failure modes common in large implementation batches.

Required anti-drift rules:

1. Prefer extracting and sharing existing logic over rewriting it.
2. One phase should own one coherent product surface. Do not mix unrelated work into the same phase.
3. Every major new UI surface must name the exact existing file or workflow it should reuse.
4. If a risky item depends on schema, metadata, or environment quality, state the blocker condition explicitly and require the coding agent to stop if that condition fails.
5. Put optional enhancements in a separate clearly labeled section or omit them.
6. Do not allow “soft completion”. Each phase must define what makes it complete and what makes it incomplete.
7. If a phase touches more than one risky seam such as provider contract, concurrency or sendability ordering, derived-state truth, or stateful UI behavior, split it or explain why the wider phase is still the smallest coherent unit.
8. When a phase introduces derived or parallel state, the brief must name every read, mutation, reset, regenerate, rewrite, approval, or refresh path that can drift.
9. When a phase touches an external provider or contract boundary, the brief must pin the exact seam QA should falsify and the exact live or runtime proof expected.
10. Require the coding agent to report exact files changed, exact tests run, exact GitHub branch used, whether the repo path stayed unchanged, exact blockers encountered, and the exact `implementation_commit_sha` for the phase state being handed to QA.
11. Require the coding agent to write that stop report into the active brief folder under `reports/` before every QA stop and to make the report body name the exact `implementation_commit_sha`.
12. Require the coding agent to refresh `reports/LATEST.md` so it truthfully points at the newest stop report and remains the reliable same-brief delta source.
13. Require every stop report to include a `Durable memory candidates` section for facts that may need promotion to repo memory at final shipgate.
14. When the repo uses machine-readable stop artifacts, require the coding agent to refresh `reports/LATEST.json` only enough to point at the same newest stop report and record `updated_at`, `stop_status`, `implementation_commit_sha`, and `stop_report_commit_sha` truthfully.
15. When the repo uses V3A automation, require the coding agent to keep `automation/state.json` truthful for the current execution status and authorized phase without doing broader automation cleanup at intermediate checkpoints.
16. Every brief must identify the source brief folder, or state that it is the first brief in the lineage.
17. Every brief must state which repo memory files are authoritative and which durable memory files must be updated at final shipgate; intermediate phases update durable memory only when a later phase or fresh session would otherwise lack a necessary new fact.
18. In serialized branch-handoff workflows, each worker gets explicit file ownership, and overlap is a hard stop condition.
19. The lead owns integration, shared interfaces, final merge or rebase, and final memory-doc updates unless the brief explicitly delegates those responsibilities.
20. QA must verify claimed files changed and tests run against git state and command evidence, not agent narration.
21. If the implementation diverges from the brief for a valid reason, record that reason explicitly in the next report, revision pack, or final memory update instead of normalizing silent drift.
22. A final shipgate pass is not complete until the required repo memory updates have been written and verified on the VPS.
23. `CLEAR_CURRENT_PHASE` for a final shipgate is emitted only after the memory-update step succeeds.
24. Multi-phase packs should default to checkpointed autonomy, not blind one-shot execution.
25. Every non-trivial multi-phase pack should label each phase as `AUTONOMOUS`, `QA_CHECKPOINT`, or `FINAL_SHIPGATE`.
26. The coding agent must stop automatically after any `QA_CHECKPOINT` or `FINAL_SHIPGATE` phase and wait for review clearance before continuing.
27. Every phase must declare one runtime `validation_level`: `NO_RUNTIME_CHECK`, `LIVE_RELOAD`, `SERVICE_RESTART`, or `FULL_REBUILD`.
28. Default to the cheapest truthful validation level for the phase.
29. Assume repo-local automation may deny Bash commands that exceed the declared `validation_level`, unless the phase explicitly names that command and the contract remains truthful.
30. Use `FULL_REBUILD` only when Docker or compose wiring, dependency install layers, env or runtime wiring, migrations, native modules, asset pipeline config, reverse proxy behavior, or cross-service contract behavior changed.
31. In `LIVE_RELOAD`, keep the stack running and refresh the served app only when needed; do not rebuild or restart unless blocked.
32. In `SERVICE_RESTART`, restart only the directly affected service or services. A service-scoped image rebuild or recreate is still acceptable when the phase explicitly named that command family for the affected service and no broader stack rebuild was required.
33. QA should evaluate runtime evidence against the planned `validation_level`, not against a blanket expectation of `docker compose up --build` after every phase.
34. Worker checkpoint verification should focus on the smallest truthful delta suite for the files changed since the last green stop, not a mechanically repeated full acceptance suite.
35. QA should rerun independently at final shipgate, after high-risk deltas, or when worker evidence is untrustworthy; otherwise it may rely on verified prior green evidence plus diff and git continuity.
36. Do not split final closeout into separate archive, memory, and shipgate reports unless closeout itself becomes blocked.
37. Every worker handoff must separate context files from the currently authorized execution window.
38. The initial handoff for a multi-phase pack should authorize only the first phase or first contiguous `AUTONOMOUS` block before the next review gate.
39. `QA_CHECKPOINT` and `FINAL_SHIPGATE` are external review gates and may not be self-cleared by the coding agent.
40. Every `QA_CHECKPOINT`, `FINAL_SHIPGATE`, or blocker stop should use a deterministic stop sequence:
   - if the phase changed tracked code or docs, create or identify the `implementation_commit_sha` before writing the stop report
   - write the stop report and refresh `reports/LATEST.md`
   - when used, refresh `reports/LATEST.json` only enough to point at the same stop report truthfully
   - when used, refresh `automation/state.json` only enough so it no longer advertises stale `READY_FOR_IMPLEMENTATION`
   - create the checkpoint or report commit that captures the report files
   - push and treat the pushed branch HEAD as `stop_report_commit_sha`
   - report branch name, `implementation_commit_sha`, `stop_report_commit_sha`, and push status distinctly
   - record only full 40-character commit IDs and verify them with live git before handing off
41. Push at review gates by default unless repo policy or the brief explicitly says otherwise.
42. Default git closeout is commit and push on the active branch only.
43. Intermediate checkpoints use a lean continuity contract: pushed code state, one timestamped report, `reports/LATEST.md`, durable memory candidates, and required machine-readable state only when already in use.
44. Intermediate checkpoints do not update full durable repo memory unless the phase changed architecture, testing, deployment, runtime-contract, or durable product-state facts needed before final shipgate.
45. Final shipgate closeout must leave the active branch pushed and `git status --short` clean after QA-owned archive, memory, report, and automation changes are committed; if scoped closeout leaves a dirty tree, do not return `CLEAR_CURRENT_PHASE`.
46. Do not ask the user to choose between direct merge, PR flow, or other landing strategies unless the user explicitly asked for merge-to-main, PR creation, or repository landing strategy.
47. Do not merge to `main`, rebase onto `main`, or open or update a PR unless the user explicitly asked for that action.
48. If QA finds only brief-local or report-local drift that it can verify directly, QA should repair that drift inline instead of spawning a revision pack.
49. When QA performs an inline brief-local repair, the accepted `implementation_commit_sha` stays attached to the implementation that passed, and any new QA-authored repair commit becomes the current `stop_report_commit_sha`.

Use directive language:

- “extract”
- “reuse”
- “do not proceed until”
- “stop and report if”
- “keep behavior identical to”
- “files to change, in order”
- “owned files”
- “required repo memory updates”

Avoid directive language that invites improvisation:

- “consider”
- “explore”
- “if useful”
- “improve UX”
- “refactor as needed”
- “modernize”

### 7. Choose the pack size deliberately

#### `brief-lite`

Use `brief-lite` when all are true:

- one coherent surface
- one branch or worker
- no schema or migration change
- no new external integration
- no auth, security, or performance-sensitive seam
- no shared UI-system, navigation, or token work
- no standalone branch-plan or audit file is needed

Required files:

1. `README.md`
2. `00-coding-agent-prompt.md`
3. `01-brief-lineage-and-sources.md`
4. `10-phase-1-implementation.md`
5. `90-final-qa-and-merge-gate.md`
6. `99-memory-pack-update.md`
7. `reports/README.md`

For `brief-lite`, keep ownership and audit context inline in `README.md` or `01-brief-lineage-and-sources.md` when they are trivial.

#### `brief-full`

Use `brief-full` when any are true:

- more than one major surface changes
- multiple phases or checkpointed autonomy are required
- schema, auth, security, performance, or integration risk exists
- branch coordination or serialized ownership handoffs are expected
- shared UI-system or navigation work is involved
- the pack needs a standalone branch plan or audit file

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

Use `brief-lite` by default for small revision packs and single-surface corrections. Escalate to `brief-full` only when the risk or coordination cost justifies the extra files.

The `README.md` must contain:

- scope
- hard rules
- execution order
- gate sequence
- definition of done
- brief lineage summary
- target GitHub branch and repo-path summary
- autonomy model summary showing where the coding agent may continue and where it must stop for QA
- the currently authorized execution window for the next handoff
- which later phases are context only until a later handoff prompt authorizes them
- the recommended read mode for the next handoff when it matters

The `00-coding-agent-prompt.md` must contain:

- the role the coding agent should adopt
- explicit anti-drift rules
- required execution discipline
- required production-grade acceptance bar, inherited from the source brief or re-established in the revision or replan pack
- required read order for repo memory and brief files
- explicit read-mode rules for `FULL_REHYDRATE`, `BRIEF_REHYDRATE`, and `HOT_RESUME`
- explicit rule that worker launch prompts should use the chosen read mode and exact read list, not mention or invoke `$auto-forge-bootstrap` by name for normal phase execution
- the compact worker handoff shape from [.agents/skills/references/worker-handoff-prompt-shape.md](.agents/skills/references/worker-handoff-prompt-shape.md)
- a `Read for context` section and a separate `Execute now` section
- the rule that the handoff should choose the lightest truthful read mode for the current state
- the rule that the coding agent may execute only the currently authorized window
- the rule that the coding agent must follow the phase `validation_level` and may escalate only if cheaper validation cannot produce truthful evidence
- the rule that the coding agent must stop at every `QA_CHECKPOINT` and `FINAL_SHIPGATE`
- the rule that `QA_CHECKPOINT` and `FINAL_SHIPGATE` are external review gates, not self-clear gates
- the rule that no later phase may begin until a new handoff prompt authorizes it
- the rule that before every QA stop it must write a Markdown report into `reports/`, refresh `reports/LATEST.md`, and make the report body name the exact `implementation_commit_sha`
- the rule that before every `QA_CHECKPOINT`, `FINAL_SHIPGATE`, or blocker stop it must create or identify the `implementation_commit_sha` first when the phase changed tracked code or docs, then create the checkpoint or report commit, push, and report branch name, `implementation_commit_sha`, `stop_report_commit_sha`, and push status distinctly
- the rule that it should push at review gates unless repo policy or the brief explicitly says otherwise

The `01-brief-lineage-and-sources.md` must contain:

- source brief folder and version
- current phase
- compare base and target branch when known
- authoritative repo memory files
- what was superseded or revised from the prior brief

When present, `02-branch-and-worktree-plan.md` must contain:

- lead GitHub branch
- any serialized branch handoff sequence
- owned files or modules per worker
- integration sequence
- stop conditions for ownership or repo-topology collisions

Each phase file must contain:

- execution mode: `AUTONOMOUS`, `QA_CHECKPOINT`, or `FINAL_SHIPGATE`
- validation level: `NO_RUNTIME_CHECK`, `LIVE_RELOAD`, `SERVICE_RESTART`, or `FULL_REBUILD`
- goal
- owned files when QA can confirm them from repo evidence; otherwise owned modules or surfaces plus clearly labeled likely file candidates
- files to change, in order, when QA can confirm them from repo evidence; otherwise concrete modules or surfaces plus clearly labeled likely file candidates
- source workflows or files to reuse
- step-by-step implementation
- required behavior
- what must not change in the phase
- required runtime evidence
- required tests for the phase
- required durable memory updates on successful completion, only when needed before final shipgate
- gate for moving forward
- whether later phases require external QA clearance before they may begin

For multi-phase packs, default to at least one `QA_CHECKPOINT` before the final shipgate unless the work is truly low-risk and tightly coupled.

The `90-final-qa-and-merge-gate.md` must contain:

- automated checks
- functional QA
- required test additions
- completion report required from the coding agent
- explicit non-goals
- the required final runtime validation level and evidence
- compare-against-brief gate
- final stop gate
- automatic memory-update requirement before final clearance
- the required completion-report file contract under `reports/`
- the rule that default branch closeout is commit and push on the active branch only
- the rule that no merge-to-`main`, PR creation, or landing-strategy choice should be proposed unless the user explicitly asked for it

The `99-memory-pack-update.md` must contain:

- which memory files must be updated
- exact facts that must be written
- which sections must change
- what must be moved from `active/` to `completed/` when the batch is accepted
- the rule that final QA must execute and verify these updates before returning `CLEAR_CURRENT_PHASE`

### 8. Deliver through local write plus SCP

When the user asks for a brief package:

1. create the Markdown files locally
2. use SCP to copy them to the user-specified remote folder or the default repo-local `docs/exec-plans/active/<brief-id>/`
3. ensure the brief includes a `reports/` scaffold on the remote side
4. verify the remote folder contents or remote `README.md`
5. if the brief supersedes a prior version, make the lineage obvious in the new files

Do not claim delivery until the remote copy is verified.

Default `BRIEF_ID` format:

- `YYYY-MM-DD-<task-slug>`
- keep the same brief folder across revision packs unless the user explicitly asks for a new batch
- record revisions as `v1`, `v2`, `v3` inside `01-brief-lineage-and-sources.md`

After verified delivery in planning mode, including QA-authored revision packs and replans, always provide these user-facing outputs without asking first:

- the brief ID
- the verified remote brief folder path
- the verified remote `README.md` path
- the verified remote `reports/` path
- a compact paste-ready launch prompt using the shared worker handoff shape, telling the coding agent to start from `README.md` and execute only the currently authorized window
  - render that prompt inline in the response body, preferably in a fenced `text` block
  - do not replace the prompt with only file paths, filenames, or “see prompt file” wording
- when the brief defines multiple worker roles, the lead launch prompt plus each worker-specific launch prompt

Do not ask whether the user wants a launch prompt or handoff message. Providing the handoff reference is the default close-out for a delivered plan bundle.

### 9. Keep planning and implementation separate

This skill is for review and briefing.

Default behavior:

- inspect
- reason
- prepare the brief
- deliver the brief

Do not modify the remote app code unless the user explicitly changes the scope from planning or review to implementation.

### 10. Project-specific defaults for iterative remote briefs

When the user is working in a project with repeated QA and handoff cycles, default to:

1. repo-local brief folders under `docs/exec-plans/active/`
2. strict runbooks, not narrative product briefs
3. one execution batch per brief
4. an explicit statement of what not to touch
5. a completion report contract that makes QA easier on the next round
6. one explicit QA stop status per review
7. a lean checkpoint continuity contract for intermediate phases and a durable memory-pack update contract for final shipgate
8. brief lineage that makes it obvious which brief a revision pack replaces or extends

## Review Output Rules

When the task is QA or review:

- findings first
- highest severity first
- include exact file references when possible
- distinguish:
  - brief-lineage gap
  - memory-drift gap
  - architecture gap
  - truthfulness gap
  - UX gap
  - data-contract gap
  - deployment gap
  - ownership or repo-topology collision
  - verification gap
- if no findings are discovered, say so explicitly and mention residual risk or coverage gaps
- end with one explicit QA stop status and next action

If the findings are limited to brief-local or report-local drift that QA can verify directly:

- repair those artifacts inline in the same QA run
- do not escalate to `REVISION_PACK_REQUIRED` unless implementation-owned files or behavior must change
- if the repair changes tracked files, commit and push it on the active branch and report the new `stop_report_commit_sha`

If the status is final-shipgate `CLEAR_CURRENT_PHASE` and the user has not explicitly asked to stop:

- do not stop at implementation acceptance alone
- execute and verify the required memory-pack updates
- archive the brief out of `active/` and verify the archived location
- reconcile updated memory docs, final reports, `reports/LATEST.*`, `automation/*.json`, current branch, and `HEAD` so all recorded commit IDs are full, resolvable, and attached to the correct meaning
- commit and push all QA-owned final closeout changes on the active branch without asking the user when they are within the accepted brief scope
- verify the pushed branch contains the final closeout `HEAD`
- verify `git status --short` is clean before returning `CLEAR_CURRENT_PHASE`; if unrelated pre-existing dirty files remain, identify them explicitly and return a blocked or limited closeout instead of silently clearing the task
- return one verified terminal closeout summary in the same run instead of separate archive or memory-closeout reports
- treat commit-and-push on the active branch as the default git endpoint unless the user explicitly asked for merge-to-`main` or PR handling

If the status is intermediate-phase `CLEAR_CURRENT_PHASE` and later phases remain, and the user has not explicitly asked to stop:

- do not stop at phase acceptance alone
- update the active brief lineage or phase status
- refresh `reports/LATEST.md` so the newest stop state reflects the QA clearance before the next handoff
- refresh `reports/LATEST.json` only when the brief uses machine-readable stop artifacts, and only with the fields needed to keep it aligned with `reports/LATEST.md` and the verified stop state
- determine the next authorized execution window from the same brief
- default the next handoff to `BRIEF_REHYDRATE` unless the brief changed materially, the branch or active repo target changed, or stale-context risk justifies `FULL_REHYDRATE`
- return the next handoff prompt in the same run
- include the full paste-ready prompt inline in the response body, not just the remote file references

If the stop status is `REVISION_PACK_REQUIRED` or `REPLAN_REQUIRED` and the user has not explicitly asked to stop:

- do not stop at findings alone
- convert the findings into the next precise revision or replan pack
- deliver and verify that pack on the VPS
- return the next handoff prompt in the same run
- include the full paste-ready prompt inline in the response body, not just the remote file references

## Delivery Rules

- prefer Markdown bundles over single huge files
- use repo-local `docs/exec-plans/active/` unless the user specifies another remote folder
- preserve task or brief IDs across revision packs
- default to `brief-lite` when its entry criteria are met; do not inflate a small correction into a full bundle
- do not inflate brief-local or reports-only corrections into a revision pack when QA can repair them inline and verify the result in the same run
- do not fragment final closeout into extra timestamped reports when one terminal shipgate closeout can carry archive and memory results truthfully
- if the user wants iterative versions, use the requested naming scheme
- if replacing a previous brief, overwrite or supersede the remote folder clearly and verify the new version landed
- for follow-up packs in the same project, preserve the same strict runbook structure unless the task cleanly fits `brief-lite`
- after failed QA, the QA agent owns the next revision or replan pack by default
- do not hand raw QA findings to the coding agent as if they were sufficient implementation guidance
- worker handoff prompts must name the current authorized execution window and make later phases context only by default
- worker handoff prompts must also name the chosen read mode and keep the read list minimal for that mode
- worker handoff prompts must not mention or invoke `$auto-forge-bootstrap` by name for normal phase execution; use `FULL_REHYDRATE`, `BRIEF_REHYDRATE`, or `HOT_RESUME` plus exact files instead
- worker handoff prompts must follow the compact shared shape in [.agents/skills/references/worker-handoff-prompt-shape.md](.agents/skills/references/worker-handoff-prompt-shape.md)
- every delivered worker handoff must be visible in the user-facing response as a full paste-ready prompt, not merely as a path to `00-coding-agent-prompt.md` or another brief file
- QA should keep same-brief continuation prompts small by default: brief `README.md`, current authorized phase file(s), `reports/LATEST.md`, and only the extra files required by the current phase or a rehydration escalation trigger
- after an intermediate-phase `CLEAR_CURRENT_PHASE`, return the next authorized worker handoff prompt by default unless the user explicitly says stop
- after any delivered planning pack, end with the verified remote handoff reference by default so the user can immediately paste it to the coding agent
- after a final-shipgate `CLEAR_CURRENT_PHASE`, end with the verified memory-closeout summary by default instead of waiting for the user to ask for closeout
- after a final-shipgate `CLEAR_CURRENT_PHASE`, the agent must archive the accepted brief by default and must not hand the archival step back to the user
- do not ask the user to choose merge-to-`main` versus PR flow as part of normal QA closeout
- default final closeout to verified commit-and-push on the active branch unless the user explicitly requested repository landing actions
- final closeout must leave the active branch pushed and `git status --short` clean, except for explicitly documented pre-existing unrelated dirty paths that prevent full clearance

## References

Load only when needed:

- [references/strict-brief-template.md](references/strict-brief-template.md)
