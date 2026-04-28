---
name: auto-forge-scope
description: Clarify the user's true intent, goals, non-goals, quality bar, and tradeoffs through a repo-grounded interview before execution planning. Use when the request is ambiguous, quality-sensitive, cross-cutting, or likely to mix feature work with cleanup, rescue, or refactor pressure.
---

# FORGE Scope

## Overview

Use this skill to identify what the user actually wants before implementation planning begins. It is an interview-style scoping workflow, not an implementation planner.

This skill exists to reduce planning misses caused by shallow problem framing, mixed goals, hidden dissatisfaction with existing code quality, or vague feature requests that do not yet state the real outcome the user wants.

This skill should:

- assume the repo has already been rehydrated through [$auto-forge-bootstrap](.agents/skills/forge-bootstrap/SKILL.md) in the current session
- infer likely intent before asking questions
- run a bounded, serious interview to resolve planning-critical ambiguity
- make quality posture, priorities, and non-goals explicit
- save a canonical scope brief under `docs/exec-plans/scope/`
- return a paste-ready handoff prompt for [$auto-forge-plan](.agents/skills/forge-plan/SKILL.md)

This skill should not drift into implementation planning. Its job is to sharpen the problem, not to design the solution in full.

## Remote Topology Guardrail

- Treat the active repo path as the only allowed filesystem root for scope work.
- Save scope artifacts only under `docs/exec-plans/scope/<scope-id>/`.
- Keep scope artifacts untracked so they do not create git or repo-hygiene complaints.
- Prefer repo-local exclusion such as `.git/info/exclude` over tracked `.gitignore` changes when exclusion needs to be established.
- Do not create `git worktree` directories, sibling clones, or duplicate repo folders.
- Do not save scope artifacts outside the active repo path.

## Default Invocation Behavior

When the user explicitly invokes this skill, assume they want a repo-grounded scoping interview, not a rigid questionnaire.

Minimum user input:

- repo target or current repo context
- the requested feature, change, cleanup, or concern

Do not require the user to provide a long planning prompt. The skill should:

- assume `$auto-forge-bootstrap` already established the repo context for the current session
- inspect only the request-relevant code surfaces and memory needed for scoping
- infer whether lite or full scoping is required
- restate the likely intent before asking questions
- ask only the highest-value follow-up questions
- stop once planning-quality intent clarity is high enough
- save the scope package automatically
- return the handoff prompt for `forge-plan` automatically

If the user already gave enough direction to proceed, do not ask extra questions just to satisfy process.

## When To Use

Use this skill when any of these are true:

- the request is ambiguous or underspecified
- the request mixes feature work with cleanup, rescue, or refactor pressure
- the user cares strongly about quality, maintainability, performance, UX, or best-practice outcomes
- prior implementation quality in the area has been poor, tangled, or hard to extend
- the request likely describes a symptom instead of the real goal
- the task spans multiple surfaces and the true priority is not obvious
- the task touches user-facing UI and the intended UX direction is not already explicit
- the user wants the planning agent to work from a sharper statement of goals

Do not use this skill for tiny, obvious, low-risk changes unless the user explicitly wants deeper scoping.

## Mode Selection

Choose one mode immediately after repo inspection.

### Lite Mode

Use lite mode when all of these are true:

- one dominant goal is already visible
- the request mostly targets one coherent surface
- ambiguity is limited to scope boundaries, success criteria, or priorities
- one interview round is likely enough
- there is no major strategic or architectural ambiguity

Lite mode rules:

- ask at most 1-3 focused questions in one round
- prefer confirming inferred intent over broad open-ended prompts
- stop as soon as planning-quality clarity is sufficient
- keep saved artifacts lean

### Full Mode

Use full mode when any of these are true:

- the true goal is not obvious from the request
- the request appears to hide dissatisfaction with current code quality or workflow shape
- feature work and cleanup or refactor concerns are intentionally or accidentally mixed together
- the task is cross-cutting or high-risk
- tradeoffs between speed, maintainability, UX, correctness, performance, or architecture matter materially
- more than one interview round is likely needed to avoid a weak plan

Full mode rules:

- ask in bounded rounds
- keep each round hypothesis-driven rather than generic
- ask at most 1-3 focused questions per round
- stop as soon as planning-critical ambiguity is resolved
- preserve more reasoning lineage in saved artifacts

### UI Intent Mode

Use UI intent mode inside lite or full mode when the task touches:

- user-facing frontend surfaces
- dashboards, tables, forms, onboarding, settings, navigation, editors, or page flows
- UI redesign, layout, density, hierarchy, interaction states, or responsive behavior
- any request where "make it better", "clean this up", "polish", "professional", or "SaaS quality" could hide an unstated UX target

UI intent mode is more inquisitive by design. Do not optimize primarily for fewer questions. Optimize for making the intended UX direction explicit enough that `forge-plan` can produce a high-quality implementation brief. Use the dedicated UI skills separately when the user wants formal UI polish or UI review.

UI intent mode rules:

- ask 3-5 focused questions per round when UX direction is still unclear
- ask at least one UX-direction question unless the user already supplied an explicit design target
- ask at least one anti-goal question about what would make the result feel wrong
- prefer concrete alternatives over vague taste questions
- continue until the target UX direction, interaction outcome, density, and states are clear enough for planning
- do not invent a new UI language when the repo already has a system unless the user explicitly wants a redesign

## Workflow

### 1. Assume bootstrap context, then inspect only what scoping needs

Assume [$auto-forge-bootstrap](.agents/skills/forge-bootstrap/SKILL.md) has already established the repo path, branch, `HEAD`, dirty state, and baseline memory context for the current session.

Do not perform bootstrap yourself from this skill.

For scoping, inspect only the additional code surfaces, memory docs, and active brief lineage that are directly relevant to the request.

If bootstrap context is missing or unreliable, stop and tell the user to run `forge-bootstrap` first instead of trying to recreate that context here.

If the active repo path is dirty and the user appears to be scoping a new implementation batch:

- do not autonomously change the repo topology
- first check whether repo memory already defines the dirty-repo policy
- if no policy exists, summarize the dirty state and stop for user direction before assuming the target execution context

### 2. Form a first-pass hypothesis

Before asking questions, infer:

- likely primary goal
- likely secondary goals
- likely pain or dissatisfaction behind the request
- likely risk surfaces
- whether this is feature work, cleanup, rescue, refactor, UX correction, or a mix
- whether the user likely wants a minimal patch or a higher-quality reshape
- whether UI intent mode is needed because the request has a UI, layout, interaction, or product-flow outcome

Use the repo and current code shape as the basis for this first pass.

### 3. Restate current understanding

Before questioning, restate:

- what the request appears to be
- what outcome the user likely cares about
- what constraints already look real from the codebase
- what still seems ambiguous
- why scoping questions are or are not needed

Keep this short, direct, and factual.

### 4. Ask dynamic follow-up questions

Ask only decision-critical questions. Avoid broad brainstorming prompts.

Question rules:

- ask at most 1-3 questions per round
- prefer hypothesis-confirming questions over blank-slate questions
- if an ambiguity is minor, proceed with a labeled assumption instead of blocking
- if the user intent appears contradictory, surface the contradiction plainly
- if UI intent mode applies, use the UI-specific 3-5 question allowance instead of the general 1-3 question cap

Good question targets include:

- the real desired outcome
- why now
- whether the real problem is feature absence, code quality, UX friction, or operational pain
- quality posture
- acceptable tradeoffs
- explicit non-goals
- what must not break
- whether the user wants a tactical patch or a higher-quality correction
- deployment or rollout expectations when user-visible behavior matters

UI-specific question targets include:

- UX direction: restrained SaaS, dense operator console, premium dashboard, editorial, playful, minimal, or another concrete direction
- reference alignment: existing repo surface to resemble, external product reference, or "not like this" example
- information hierarchy: what should dominate, what should recede, primary action, and supporting actions
- density and rhythm: compact data-heavy, spacious guided flow, or balanced operational layout
- layout model: sidebar, topnav, cards, table-first, split-pane, wizard, feed, detail view, or another known pattern
- component reuse: preserve the current UI system, make a targeted exception, or intentionally redesign a surface
- state coverage: loading, empty, error, success, disabled, overflow, long-content, mobile, and desktop expectations
- interaction feel: fast operator workflow, calm guided workflow, review-and-approve flow, creation flow, or exploration flow
- UX anti-goals: what would feel wrong, cheap, cluttered, generic, off-brand, too dense, too sparse, or too unlike the intended product

Avoid asking for details that `forge-plan` can discover directly from the code.

### 5. Identify quality posture

Make the desired quality posture explicit. Classify it as one of:

- minimal patch
- clean refactor
- staged cleanup plus feature
- best-practice redesign
- narrow performance-focused rewrite
- UX correction with minimal backend churn

If the request appears to be underselling a deeper cleanup need, say so and test whether the user wants that need included or excluded.

### 6. Rank priorities

When needed, rank the user's real priorities. Common categories include:

- correctness
- maintainability
- performance
- UX quality
- speed to ship
- minimal churn
- architectural cleanliness
- operational simplicity

Do not force artificial ranking when the priority order is already obvious from the discussion.

### 6A. Define UI intent when applicable

When UI intent mode applies, make these explicit before closing the interview:

- UX direction
- reference surfaces to follow or avoid
- target user journey and primary action
- desired information hierarchy
- desired density and layout model
- component reuse expectations
- required interaction states
- responsive expectations
- UX anti-goals

If any of these remain unclear, ask another focused round instead of handing vague taste language to `forge-plan`.

### 6B. Define production-grade best-practice expectations

Every scope brief must make the production-grade quality bar explicit. This applies to backend, APIs, Python, frontend, data, infrastructure, tests, security, performance, and operational behavior.

Before closing the interview, state that the eventual implementation plan must be grounded in:

- industry-standard production engineering norms for the affected domain
- the repo's established architecture, conventions, and reusable patterns
- current official documentation or primary sources for the relevant framework, library, platform, API, or provider when guidance may be version-sensitive or high-risk
- security, reliability, maintainability, observability, accessibility, and performance expectations appropriate to the task

If the user's desired outcome appears to conflict with production-grade or stack-specific best practice, surface the conflict and capture the approved tradeoff explicitly. Do not let `forge-plan` receive a scope brief that implies a shortcut is acceptable unless the user intentionally approved that shortcut.

If production-grade expectations may depend on current framework, library, provider, security, performance, accessibility, API, deployment, or platform guidance, mark external primary-source research as required for `forge-plan`. Name the expected source category in the scope brief instead of assuming repo-local convention is enough.

### 7. Define success and anti-goals

Before closing the interview, make explicit:

- success criteria
- non-goals
- what must be preserved
- acceptable tradeoffs
- unacceptable tradeoffs
- shortcuts that would make the result wrong even if it technically works
- failure modes the plan must avoid

### 8. Stop when confidence is sufficient

Stop the interview when all of these are true:

- the primary goal is explicit
- the desired outcome is explicit
- non-goals are explicit
- quality posture is explicit
- production-grade best-practice expectations are explicit
- priority order is clear enough for planning
- planning-critical ambiguity is resolved
- for UI work, UX direction, hierarchy, density, states, and responsive expectations are explicit enough for planning

Do not continue asking questions just to satisfy process.

### 9. Produce the scope package

Create a canonical scope brief that `forge-plan` can treat as the authoritative statement of user intent.

In full mode, also save the codebase framing and interview lineage that produced the brief.

### 10. Save the scope package in the repo

Save all scope artifacts under:

- `docs/exec-plans/scope/<scope-id>/`

Before claiming completion, verify:

- the folder exists
- the canonical scope brief exists
- the `forge-plan` handoff prompt exists
- `git status --short -- docs/exec-plans/scope/<scope-id>/` does not show scope artifacts as untracked noise
- if scope artifacts would appear in `git status`, add the narrowest repo-local exclusion such as `docs/exec-plans/scope/` to `.git/info/exclude`, then verify status again
- do not modify tracked `.gitignore` unless the user explicitly wants a repo-wide scope artifact policy

## Interview Rules

- Be direct, serious, and pragmatic.
- Use the repo to sharpen questions before asking them.
- Prefer narrowing alternatives over vague prompts.
- Do not ask “what do you want?” when a stronger repo-grounded hypothesis can be presented for confirmation.
- Separate what the user explicitly said from what you infer.
- If prior implementation quality is part of the real problem, surface that possibility clearly.
- Do not drift into architecture selection or phase design unless needed to expose a user-level tradeoff.
- Do not produce an execution brief. Hand off to `forge-plan` once intent is clear enough.

## Output Contract

Every scope run must produce one canonical scope brief.

Required fields:

- `scope_id`
- `title`
- `mode`
- `request_summary`
- `interpreted_primary_goal`
- `interpreted_secondary_goals`
- `why_now`
- `problem_statement`
- `desired_outcome`
- `in_scope`
- `out_of_scope`
- `quality_posture`
- `production_grade_quality_bar`
- `production_grade_source_of_truth`
- `external_primary_source_research_required`
- `industry_best_practice_requirements`
- `technology_documentation_requirements`
- `security_reliability_performance_expectations`
- `ui_intent_mode`
- `ux_direction`
- `reference_surfaces`
- `target_user_journey`
- `primary_action`
- `information_hierarchy`
- `ui_density`
- `layout_model`
- `component_reuse_expectations`
- `interaction_states`
- `responsive_expectations`
- `ux_anti_goals`
- `priority_order`
- `must_preserve`
- `acceptable_tradeoffs`
- `unacceptable_tradeoffs`
- `repo_surfaces_implicated`
- `user_stated_constraints`
- `agent_inferred_constraints`
- `success_criteria`
- `failure_modes_to_avoid`
- `open_questions`
- `approved_assumptions`
- `recommended_planning_mode`
- `notes_for_forge_plan`

The canonical brief should be factual, concise, and strong enough that a fresh planning session can begin from it without repeating the whole interview.

## Artifact Layout

### Lite Mode

Required files:

1. `README.md`
2. `scope-brief.md`
3. `forge-plan-handoff.md`

### Full Mode

Required files:

1. `README.md`
2. `00-codebase-framing.md`
3. `01-intent-interview.md`
4. `02-goals-tradeoffs-and-non-goals.md`
5. `03-scope-brief.md`
6. `04-forge-plan-handoff.md`

Canonical brief path:

- lite mode: `scope-brief.md`
- full mode: `03-scope-brief.md`

`README.md` must contain:

- scope summary
- mode used
- current confidence level
- primary goal
- quality posture
- canonical brief path
- forge-plan handoff path
- recommended next action

## Handoff To Forge-Plan

The final saved prompt for `forge-plan` must tell it to:

- treat the scope brief as the authoritative statement of user intent
- validate the scope brief against the live repo before planning
- ask only planning-specific follow-up questions when technical uncertainty still blocks a high-quality plan
- preserve the stated goals, non-goals, quality posture, and priority order
- ground every implementation recommendation in production-grade industry norms and the best practices of the affected technology stack
- consult current official documentation or primary sources when framework, library, provider, security, performance, accessibility, or API guidance may be version-sensitive or high-risk
- determine whether the production-grade bar comes from repo conventions, external primary-source research, or an explicit user-approved tradeoff, and state that source in the plan
- generate the best-fit, highest-quality repo-grounded plan rather than merely the shortest implementation path

Do not make `forge-plan` rediscover the user's true goal from scratch if the scope brief already resolved it.

## User-Facing Output

At the end of every successful scope run, return:

- a concise scoping summary
- the mode used
- the confidence level
- the canonical scope brief path
- the saved scope folder path
- the paste-ready `forge-plan` handoff prompt

Do not ask whether the user wants the handoff prompt after the scope brief is complete. Returning it is the default close-out.

## Delivery Rules

- prefer short, high-signal markdown over long narrative notes
- keep scope artifacts local to `docs/exec-plans/scope/`
- keep them untracked to avoid repo-hygiene complaints
- do not turn scoping notes into tracked execution lineage unless the user explicitly wants that workflow
- if the same request is rescoped later, either overwrite clearly or version the scope folder deliberately; do not leave ambiguous duplicates without a clear canonical brief
- do not create implementation briefs, QA packs, or revision packs from this skill
- after scoping, route to `forge-plan` for actual execution planning

## References

Load only when needed:

- [$auto-forge-bootstrap](.agents/skills/forge-bootstrap/SKILL.md)
- [$auto-forge-plan](.agents/skills/forge-plan/SKILL.md)
