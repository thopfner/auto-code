# Root Cause And Required Direction

## Issue List

1. Manual Forge workflow requires the operator to copy prompts between CLI sessions.
2. Agent handoff state currently lives in chat, terminals, and human memory.
3. Multiple repos/tasks need serialized, durable automation.
4. Telegram/OpenClaw should be the operator interface, but not the durable workflow brain.
5. The product must be portable across VPS and local desktop installs.

## Why Each Issue Exists

- Forge is intentionally strict about reports, briefs, checkpoints, and memory, but it has no external durable orchestrator yet.
- OpenClaw can route messages and run tasks, but Forge-specific artifact validation and repo locks require a dedicated controller.
- Tmux sessions are useful visibility but do not provide a reliable task state machine.

## Required Direction

Build a controller with durable state, queueing, role-based runners, repo locks, artifact reconciliation, and a web onboarding UI. Use OpenClaw as Telegram-facing gateway and Codex as the execution engine.

## Evidence Checked

Planning reviewed current Forge skill contracts, OpenAI Codex automation/auth docs, OpenClaw Telegram/TaskFlow/ACP/webhooks docs, Telegram Bot API docs, and lobstr.io docs.

## Stop Condition If Assumptions Break

Stop if the current versions of OpenClaw or Codex cannot be automated safely without relying on interactive screen scraping.

