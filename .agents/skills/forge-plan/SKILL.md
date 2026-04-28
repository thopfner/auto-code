---
name: auto-forge-plan
description: Interactively scope a feature or implementation task from Codex Local by rehydrating from repo memory over SSH, reviewing the live codebase, deciding whether external best-practice research is required, comparing viable approaches, and reaching explicit user agreement before creating and delivering the initial execution brief pack to the VPS. Use for major new features, complex refactors, integrations, schema changes, architecture-sensitive work, or any task where the best implementation approach is not obvious.
---

# Interactive Feature Planning

## Overview

Use this skill to prevent the planning agent from jumping straight from a user request to an execution brief. It forces a cooperative planning loop: rehydrate from the repo, inspect the code, decide whether best-practice research is needed, compare options, recommend a path, and get user alignment before execution planning.

In the Codex Local -> SSH -> VPS workflow, this skill owns initial feature planning and first-pack delivery. It does not replace repo rehydration, and it hands follow-on QA, phase clearance, revision-pack authorship, and replan authorship to the execution-handoff workflow.

Use it with:

- [$auto-forge-bootstrap](.agents/skills/forge-bootstrap/SKILL.md) to rehydrate from repo memory and live code
- optional [$auto-forge-scope](.agents/skills/forge-scope/SKILL.md) when the user wants intent, quality posture, or non-goals clarified before planning
- [$auto-forge-qa-brief](.agents/skills/forge-qa-brief/SKILL.md) after the first implementation pass, when QA needs a revision pack or replan, and when the QA agent should author and deliver that next pack

## Remote Topology Guardrail

- Treat the active VPS repo path as the only allowed filesystem root for planning and brief delivery.
- When the user asks for a new branch or worktree, interpret that as a GitHub branch request only. Do not create `git worktree` directories, sibling clones, or duplicated repo folders.
- Keep all planning artifacts, reports, and automation files inside the active repo path, normally under `docs/exec-plans/active/<brief-id>/`.

## Default Invocation Behavior

When the user explicitly invokes this skill, assume they want an interactive planning process, not a rigid planning template.

Minimum user input:

- repo target or current repo context
- the requested feature, change, or implementation idea

Do not require the user to provide a multi-point planning prompt. The skill should:

- rehydrate from repo memory and inspect the code
- treat a user-provided scope brief or `forge-plan-handoff.md` as optional authoritative intent input, while still validating it against the live repo
- infer whether quick or deep planning is required
- ask only the highest-value clarification questions when needed
- recommend a path
- get agreement for deep-mode work
- then create and deliver the initial implementation pack automatically if the user confirms

If the user already gave enough direction to proceed, do not ask extra questions just to satisfy process.

## When To Use

- new features
- new integrations
- schema or migration work
- auth, payments, permissions, security, or performance-sensitive work
- cross-cutting refactors
- tasks touching more than one major product surface
- tasks where “best practice” is a real design question
- any time the user wants to compare approaches before coding

Do not use this skill for small bug fixes, narrow UI polish, tiny copy updates, or other low-risk changes unless the user explicitly wants a deeper planning discussion.

## Mode Selection

Choose one mode immediately after rehydration.

### Quick mode

Use quick mode when all of these are true:

- one coherent surface
- no meaningful architectural decision
- no new external integration
- no schema or data-model change
- no auth, security, or performance sensitivity
- low ambiguity in the current codebase

Quick mode should still inspect the code and restate constraints, but it can skip multi-option research unless a major unknown appears.
Keep quick-mode packs lean. Do not emit high-risk contract machinery for a low-risk slice.
Default to `brief-lite` when the agreed execution slice stays within quick-mode bounds.
For truly small quick-mode packs, keep lineage inline in `README.md` unless a separate lineage file would materially reduce ambiguity.

### Deep mode

Use deep mode when any of these are true:

- new subsystem or major feature
- new third-party integration
- schema, migration, or persistence change
- auth, payments, permissions, or security implications
- performance or scalability implications
- more than roughly 3 modules or surfaces are likely to change
- the correct implementation pattern is not obvious
- the user asks for best practice, architecture, or option comparison

If any deep-mode trigger is true, do not jump directly to an execution brief.

## Production-Grade Default

All scoped and planned work defaults to production-grade, ship-ready implementation quality unless the user explicitly approves a temporary or prototype-grade compromise.

Production-grade means the planned implementation must be maintainable, idiomatic for the repo and technology stack, covered by the smallest truthful tests or runtime proof, compatible with existing architecture, and free of known follow-up refactor debt inside the touched surface.

Do not plan "make it work now, clean it later" work unless the user explicitly chooses that tradeoff. If the smallest implementation would leave avoidable design debt, brittle coupling, duplicated logic, untested behavior, or a known refactor immediately required, either include the cleanup in the same slice or surface the tradeoff before briefing execution.

Before defining the `Production-grade acceptance bar`, determine the source of truth for what production-grade means for this task:

- repo-local sources: existing architecture, repo memory docs, test and deployment docs, and established component, API, data, service, and UI conventions
- external primary-source research: official framework docs, official library docs, vendor docs, standards, RFCs, or authoritative platform guidance
- explicit user-approved tradeoff: only when the user knowingly accepts a lower bar, temporary compromise, or staged cleanup boundary

The execution brief must state whether the production-grade bar was derived from repo conventions, external primary-source research, or an explicit user-approved tradeoff.

## Contract Depth

Use the lightest phase contract that is still truthful.

### Lean phase contract

Use this for low-risk phases. Require only:

- goal
- explicit non-goals
- exact files when repo inspection confirms them; otherwise concrete modules or surfaces plus clearly labeled likely file candidates
- required reuse points
- validation level
- smallest truthful tests or runtime checks
- stop gate

### Enhanced phase contract

Use this only when a phase touches at least one risky seam:

- schema, migration, backfill, or persistence truth
- auth, tenant boundary, secrets, or permissions
- external provider or API contract
- async, outbox, claim, retry, or sendability ordering
- derived or parallel state that can drift
- stateful UI or editor flows that must stay aligned across read, edit, save, refresh, regenerate, rewrite, approve, or reclassify

For an enhanced phase contract, require:

- the exact risky seam inventory
- the edge-state matrix the phase must preserve:
  - legacy, current, null, missing, archived, partial, or invalid states as relevant
- every read path and mutation path that can touch the new or changed state
- exact files when confidently known from repo inspection; otherwise concrete modules or surfaces plus clearly labeled likely file candidates
- fail-closed behavior and blocker conditions
- checkpoint usability:
  - what must still work on the live branch before the next phase begins
- the smallest direct proof for the external or concurrency seam when one exists
- a compact proof map for each risky seam:
  - seam
  - exact code path or reuse point
  - targeted regression command
  - required manual or live proof when applicable

When the phase owns a stateful frontend surface with filters, tabs, search, tables, editors, or persisted view state, make the UX contract explicit instead of leaving it implicit. Name:

- cold-start loading behavior
- hydrated refetch behavior
- whether stale data stays mounted during refresh
- nearby summary-count truth during refresh
- failure behavior after at least one successful load
- route-transition or refresh persistence requirements

If one phase touches more than one risky seam, split it or justify in the brief why the combined phase is still the smallest coherent slice.
Do not present speculative file paths as fixed requirements.

## Workflow

### 1. Rehydrate and inspect first

If the repo has not been rehydrated in the current session, first do the equivalent of [$auto-forge-bootstrap](.agents/skills/forge-bootstrap/SKILL.md):

- read `AGENTS.md`, `CLAUDE.md`, and `docs/agent-memory/*.md`
- inspect live git state
- inspect the relevant code surfaces

Do not propose architecture from chat memory alone.

If the same repo path, GitHub branch, `HEAD`, `git status --short`, and active brief folder are already confirmed in the current session, you may abbreviate rehydration to changed files plus any newly relevant memory docs.

If the active repo path is dirty and the task is a new feature or new implementation batch:

- do not autonomously create a `git worktree`, duplicate the repo into another folder, redirect execution to another repo path, or silently change the target topology just because the active repo path is dirty
- first check whether `CLAUDE.md` or `docs/agent-memory/PARALLEL_RULES.md` explicitly defines what to do in this situation
- if no explicit dirty-repo policy exists, stop and ask the user which topology to use before continuing execution planning

If the user gave only a short feature request, use the repo memory and code inspection to build the first-pass framing before asking follow-up questions.

### 2. Lock the problem framing

Before planning, restate:

- objective
- desired user or system outcome
- explicit non-goals
- known constraints
- invariants and do-not-break rules
- relevant code surfaces already identified
- important unknowns

If the user provides a saved scope brief or `forge-plan-handoff.md`, use it as the starting problem framing. Preserve its goals, non-goals, quality posture, priority order, and success criteria unless live repo reality or explicit user direction contradicts them.

If a critical decision cannot be made safely, ask only the highest-leverage clarification questions. Keep this tight. Do not interrogate the user for minor details that can be discovered from the code.

Default to at most 1-3 focused follow-up questions in one round. If the unknowns are non-critical, proceed with labeled assumptions instead of blocking.

### 3. Run the production-grade research gate

Before recommending an approach or defining the `Production-grade acceptance bar`, determine whether the task's quality bar is already knowable from repo-local sources or requires external primary-source research.

Use repo-local sources first:

- existing architecture and patterns
- repo memory docs
- test and deployment docs
- established component, API, data, service, and UI conventions

External best-practice research is mandatory when:

- the task touches framework, library, platform, provider, security, auth, payments, performance, accessibility, standards, compliance, deployment, or data-model behavior
- the correct production-grade pattern is not already clear from the repo
- current vendor or framework guidance may have changed
- the user asks for best practice, robust, ship-ready, production-grade, or long-term maintainable work

When external research is required, use primary sources only:

- official framework docs
- official library docs
- vendor docs
- standards or RFCs when relevant
- authoritative platform guidance

Do not rely on blogs or generic summaries unless no primary source exists, and mark that limitation clearly.

Compare external guidance against the actual repo before recommending anything. "Industry default" is not automatically "best fit for this codebase."

State whether the production-grade bar was derived from repo conventions, external primary-source research, or an explicit user-approved tradeoff.

### 4. Build the option set

For deep mode, produce at least 2 viable approaches:

- simplest acceptable path
- recommended path
- optional more advanced path if it is realistically relevant

For each option, evaluate:

- fit with the current codebase
- implementation complexity
- operational or maintenance burden
- migration or rollout risk
- testing implications
- why it may be too weak or too heavy

For quick mode, one main path plus one fallback is enough if the task is genuinely simple.

### 5. Recommend one path

Choose one approach and explain:

- why it best fits this repo now
- why it is better than the alternatives for this task
- what future growth would justify a different choice later

Mark clearly what is confirmed from code and sources versus what is an inference.

### 6. Get explicit agreement for deep-mode work

For deep mode:

- do not create an execution brief until the user explicitly agrees to the recommended direction or asks you to revise it

For quick mode:

- you may proceed directly to a brief if the recommendation is straightforward and the user intent is already clear

### 7. Create and deliver the initial execution pack after agreement

Once the user agrees and wants execution planning:

- create a `BRIEF_ID` using `YYYY-MM-DD-<task-slug>` unless the repo already has a stricter naming rule
- save the planning rationale into the brief lineage
- include a `Production-grade acceptance bar` section in every execution pack:
  - what ship-ready means for this repo and task
  - whether the bar came from repo conventions, external primary-source research, or an explicit user-approved tradeoff
  - what shortcuts are explicitly forbidden
  - what tests, runtime checks, manual review, or source citations prove the work is not just functional but maintainable
  - any approved compromise, if the user explicitly accepted one
- keep lineage in one stable place:
  - `README.md` for trivial quick-mode packs
  - `01-brief-lineage-and-sources.md` when a separate lineage file materially improves clarity
  - do not split revision history across both unless the pack explicitly says which one is canonical
- include machine-readable stop-artifact scaffolding in every new pack:
  - initialize `reports/LATEST.json` with at least `brief_id`, `latest_report`, `updated_at`, `stop_status`, `implementation_commit_sha`, and `stop_report_commit_sha`
  - when the repo already uses automation artifacts or repeated QA cycles are expected, also scaffold `automation/state.json` and `automation/qa.json`
  - `automation/state.json` should, at minimum, declare `brief_id`, `authorized_phase`, `status`, `read_mode`, `validation_level`, `owned_paths`, `allowed_commands`, `branch`, `worktree`, and `updated_at`
  - in forge workflows, keep `automation/state.json`.`worktree` as `null`; branch changes happen inside the active repo path and do not authorize duplicate repo directories
  - `automation/qa.json` should, at minimum, declare `brief_id`, `qa_status`, `last_reviewed_phase`, `next_authorized_phase`, `latest_report`, `implementation_commit_sha`, `stop_report_commit_sha`, `finding_types`, and `updated_at`
  - in machine-readable JSON artifacts, use full 40-character commit SHAs rather than short SHAs
- choose `brief-lite` when the task stays on one coherent surface with one worker and no schema, integration, auth, security, performance, or shared UI-system risk
- choose `brief-full` when the task needs multiple phases, parallel ownership, or a dedicated audit or branch-plan layer
- before drafting phases, identify which risky seams each phase touches, if any
- for each phase, scope the implementation targets with confidence:
  - use exact files only when the current repo inspection makes them genuinely clear
  - otherwise name concrete modules or surfaces and clearly label any likely file candidates as likely rather than fixed
- keep low-risk phases on the lean phase contract
- give high-risk phases the enhanced phase contract only for the seams they actually touch
- if a phase touches more than one risky seam, split it or explicitly justify why one combined phase is still safer than two narrower ones
- if the active repo path is dirty and the execution topology for the new batch has not been explicitly approved, stop and ask before changing the target branch or repo path; do not create a `git worktree` or duplicate checkout
- assign a runtime `validation_level` to every phase: `NO_RUNTIME_CHECK`, `LIVE_RELOAD`, `SERVICE_RESTART`, or `FULL_REBUILD`
- default each phase to the cheapest truthful validation level
- assume repo-local automation may enforce `validation_level` at Bash-tool time for coding agents
- require `FULL_REBUILD` only when the phase changes a real runtime boundary such as Docker or compose wiring, dependency install layers, env or runtime wiring, migrations, native modules, asset pipeline config, reverse proxy behavior, or cross-service contract behavior
- when code is image-baked or production assets only become truthful after a service-scoped rebuild, a single-service `docker compose build`, `docker compose up --build`, or recreate command can still live under `SERVICE_RESTART` as long as the phase names that exact service-bound command family in `allowed_commands`
- reserve `FULL_REBUILD` for stack-wide or multi-service rebuilds, or for true runtime-boundary changes where a cheaper service-scoped refresh would create false confidence
- when a phase introduces derived or parallel state, name every mutation, reset, and read path that must stay in sync
- when a phase touches an external provider or API contract, pin the exact request or response assumptions QA must verify rather than relying on broad “provider works” language
- when a phase touches outbox, async, claim, retry, or release semantics, state exactly when rows become durable, visible, and worker-claimable
- when a phase ends in an intermediate checkpoint, state what must remain usable on the live branch at that checkpoint
- define verification economy for every phase:
  - name the smallest truthful delta checks for worker checkpoints
  - name any final acceptance suite that QA should rerun independently at final shipgate
  - allow prior green evidence to stand when no relevant code or runtime delta occurred since the last green stop
- if the batch includes user-visible frontend changes, require the final shipgate to name the exact runtime action needed for those changes to become visible in the real served frontend; do not leave final shipgate at `LIVE_RELOAD` when the frontend requires rebuild, recreate, or deploy work to become truthful
- default to checkpointed autonomy for multi-phase work:
  - mark low-risk contiguous phases as `AUTONOMOUS`
  - insert `QA_CHECKPOINT` phases at meaningful review boundaries
  - end the pack with `FINAL_SHIPGATE`
- avoid stacking adjacent `QA_CHECKPOINT` phases on the same UI surface unless distinct regression seams justify separate review stops
- do not place `FINAL_SHIPGATE` before the likely stabilization boundary for the batch
- define the initial authorized execution window:
  - authorize only the first phase when it ends in `QA_CHECKPOINT` or `FINAL_SHIPGATE`
  - authorize a contiguous `AUTONOMOUS` block only when those phases are intentionally safe to run without review between them
  - never let the initial handoff silently authorize phases beyond the next review gate
- when writing the paste-ready worker launch prompt, follow the compact shared shape in [.agents/skills/references/worker-handoff-prompt-shape.md](.agents/skills/references/worker-handoff-prompt-shape.md)
- make the worker handoff separate `Read for context` from `Execute now`
- make the worker handoff state: "The implementation must satisfy the brief's production-grade acceptance bar. Do not leave known cleanup, duplicated logic, brittle seams, TODO-driven behavior, untested behavior, or immediate refactor debt unless the brief explicitly authorizes that compromise."
- do not mention or invoke `$auto-forge-bootstrap` in normal coding-agent launch prompts; worker prompts should use the declared read mode and exact read list instead
- declare the worker handoff read mode explicitly:
  - default the first handoff for a new batch to `FULL_REHYDRATE`
  - `FULL_REHYDRATE` means bootstrap-equivalent repo and brief reads, not mentioning or invoking `$auto-forge-bootstrap` unless the user explicitly asked for a fresh bootstrap session instead of phase execution
  - use `BRIEF_REHYDRATE` only when the execution is continuing on the same brief with already-confirmed context
  - reserve `HOT_RESUME` for the same live coding session when no meaningful state changed
- keep the read list minimal for the chosen mode instead of forcing `docs/agent-memory/*.md` on every same-brief continuation
- make same-brief continuation prompts default to brief `README.md`, the current authorized phase file(s), and `reports/LATEST.md`, then add only the extra files required by the current phase
- include explicit rehydration escalation triggers in the handoff:
  - branch or active repo target changed
  - active brief or brief lineage changed materially
  - dirty state or topology changed
  - authoritative testing, architecture, UI-system, or runtime-contract docs changed
  - the smaller context set is no longer enough to execute or verify truthfully
- state that `QA_CHECKPOINT` and `FINAL_SHIPGATE` are external review gates and may not be self-cleared by the coding agent
- require checkpoint git hygiene:
  - create a commit before every `QA_CHECKPOINT`, `FINAL_SHIPGATE`, or blocker stop
  - report the branch name, `implementation_commit_sha`, `stop_report_commit_sha`, and push status in the stop report
  - refresh `reports/LATEST.md` at every review gate or blocker stop so it remains the one authoritative latest stop summary
  - refresh `reports/LATEST.json` only when the pack already uses machine-readable stop artifacts or automation depends on it, and keep it truthfully aligned with `reports/LATEST.md`
  - when the repo uses V3A automation, require only the minimum `automation/state.json` update needed to stop advertising stale `READY_FOR_IMPLEMENTATION`; defer broader automation or durable memory cleanup to QA clearance or final shipgate unless the current phase needs it
  - push at review gates unless repo policy or the brief explicitly says otherwise
- require lean checkpoint continuity:
  - intermediate `QA_CHECKPOINT` stops should preserve enough truth for `/clear` recovery and the next handoff: pushed code, one timestamped stop report, `reports/LATEST.md`, and any required machine-readable state
  - every stop report should include a `Durable memory candidates` section for facts that may need promotion to repo memory at final shipgate
  - intermediate checkpoints should not update full durable repo memory unless the phase changed architecture, testing, deployment, runtime-contract, or product-state facts that later phases or fresh sessions need before final shipgate
  - final durable memory closeout remains a `FINAL_SHIPGATE` responsibility through `99-memory-pack-update.md`
- require final closeout hygiene:
  - final QA must commit and push accepted brief-scope closeout changes without asking the user, including memory updates, final reports, automation updates, and active-to-completed archive moves
  - final QA must verify the pushed branch contains the final closeout `HEAD`
  - final QA must verify `git status --short` is clean before returning `CLEAR_CURRENT_PHASE`
  - final QA must not silently commit unrelated dirty files; if unrelated pre-existing dirty state remains, it must block or report limited closeout instead of marking the task fully closed
- generate the coding-agent pack under `docs/exec-plans/active/<brief-id>/`
- SCP the pack to the active VPS repo location
- verify the remote brief folder and remote `README.md`
- return the verified handoff reference automatically

For deep mode, save at least:

- `00-problem-framing.md`
- `01-options-and-recommendation.md`

These should live alongside the execution brief under `docs/exec-plans/active/<brief-id>/` when the user wants persistent plan lineage.

Do not ask whether the user wants the handoff pack after they have already approved the approach. Approved deep-mode planning should transition directly into execution-pack creation unless the user explicitly asks to stop before briefing.

Use [$auto-forge-qa-brief](.agents/skills/forge-qa-brief/SKILL.md) against the same brief lineage when later QA, phase clearance, or revision work is needed.

## Planning Rules

- Prefer repo reality over generic architecture advice.
- Always consider the simplest acceptable solution before proposing a sophisticated one.
- Do not treat “best practice” as a synonym for “most complex.”
- Do not treat "production-grade" as optional polish. It is the default completion bar unless the user explicitly approves a lower temporary bar.
- Do not generate an execution pack that knowingly leaves avoidable immediate refactor debt inside the touched surface without naming and getting approval for that compromise.
- Deep mode must consider alternatives before converging.
- If the current repo has a strong established pattern, bias toward extending it unless there is a clear reason to change.
- Prefer repo-grounded file specificity only when confidence is high. When confidence is lower, name concrete modules or surfaces and clearly label likely file candidates instead of turning guesses into fixed plan requirements.
- If a recommendation would create a long-term architectural shift, call that out explicitly and record it in the plan.
- If the task is ambiguous, spend planning effort on de-risking unknowns, not on writing a polished but speculative brief.
- Do not default to one-shot multi-phase execution for non-trivial work. Prefer checkpointed autonomy.
- Do not let a single phase mix provider-contract risk, concurrency risk, and stateful UI risk unless the brief explains why that wider phase is still the smallest coherent unit.
- When a phase introduces derived or parallel state, name all write paths, reset paths, and read paths that must remain aligned.
- When a phase depends on an external provider or API contract, require one direct falsifiable proof seam for QA, not just broad green tests.
- Intermediate checkpoints should leave the live branch usable for the surfaces already exposed, unless the brief explicitly authorizes a temporary broken state and explains the boundary.
- Do not label a phase `LIVE_RELOAD` or `SERVICE_RESTART` and then quietly rely on rebuild-only commands unless those commands are named explicitly and the validation level is still truthful.
- In image-baked frontend or backend services, a service-scoped rebuild or recreate for the directly affected service may still be truthful under `SERVICE_RESTART` when the command is explicit and no broader stack rebuild is required.
- Worker launch prompts must authorize a bounded execution window, not the whole pack by implication.
- Worker launch prompts should use the shared compact shape in [.agents/skills/references/worker-handoff-prompt-shape.md](.agents/skills/references/worker-handoff-prompt-shape.md).
- Worker launch prompts should not mention or invoke `$auto-forge-bootstrap` by name. They should name the read mode and exact files to read.
- Worker launch prompts should also authorize the lightest truthful read mode, not the heaviest possible reread.
- Worker launch prompts should treat `reports/LATEST.md` as the default delta source for same-brief continuation instead of restating large static context.
- If the repo uses V3A automation, worker launch prompts should also keep `automation/state.json` authoritative for the current phase, owned paths, validation level, and execution status instead of leaving those facts to transcript inference.
- If the repo already uses machine-readable brief artifacts, keep `reports/LATEST.json` and any `automation/*.json` files truthful alongside the Markdown brief state.
- `QA_CHECKPOINT` and `FINAL_SHIPGATE` mean external review clearance is required before later phases may begin.
- Dirty active repo state is a user-decision boundary unless repo memory explicitly defines the topology rule.
- Never create a `git worktree`, sibling clone, or duplicate repo checkout as part of forge planning. If the active repo path is dirty, stop and ask whether to continue in place, clean the tree, or switch GitHub branches inside that same repo path.
- Do not default to `brief-full` when a `brief-lite` pack would preserve the same safety.
- Do not default to `docker compose up --build` after every phase.
- For most UI phases, prefer `LIVE_RELOAD` when the existing running stack stays truthful.
- For most backend phases, prefer `SERVICE_RESTART` when only one service needs a fresh process.
- When a frontend or backend service requires a service-scoped image rebuild to pick up code changes, keep it under `SERVICE_RESTART` if the rebuild is limited to that directly affected service and the phase lists the allowed command family explicitly.
- Only use `FULL_REBUILD` when a cheaper validation level would create false confidence.
- Use QA checkpoints after risky boundaries such as schema changes, shared runtime seam changes, integration boundaries, auth or security changes, or broad UI behavior changes.
- Only allow a fully autonomous phase run across multiple phases when the phases are tightly coupled, low risk, and cheap to unwind.
- Do not force identical targeted test, build, or deploy reruns at every checkpoint when the later stop has no relevant code or runtime delta from the last green evidence.
- For same-surface UI refinement, prefer broader phases with stronger acceptance criteria over many adjacent checkpoints.

## Output Contract

### Quick mode

Return:

- task framing
- key codebase findings
- recommended approach
- important risks
- whether a `brief-lite` or `brief-full` pack should now be created

### Deep mode

Return:

- task framing
- relevant codebase findings
- best-practice research findings when research was required
- option comparison
- recommended approach
- open decisions or questions
- explicit request for agreement before execution briefing

If the user agrees and wants execution, transition automatically to the execution-brief workflow and return:

- the `BRIEF_ID`
- whether the pack used `brief-lite` or `brief-full`
- the verified remote brief folder path
- the verified remote `README.md` path
- the paste-ready worker launch prompt for the initial authorized execution window

If the user invokes this skill with only a feature request, treat that as enough to begin the interactive planning loop.

## References

- Open [references/routing-and-research.md](references/routing-and-research.md) for the quick-vs-deep rubric and research triggers.
- Open [references/planning-artifacts.md](references/planning-artifacts.md) for the required structure of `00-problem-framing.md` and `01-options-and-recommendation.md`.
