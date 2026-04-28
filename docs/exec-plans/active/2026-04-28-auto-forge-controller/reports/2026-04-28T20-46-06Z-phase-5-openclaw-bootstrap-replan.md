# Phase 5 OpenClaw Bootstrap Replan

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-28T20:46:06Z`
Stop status: `READY_FOR_IMPLEMENTATION`

## Phase Authorized

- `59-phase-5-revision-openclaw-bootstrap.md`
- Execution mode: `FINAL_SHIPGATE_REVISION`
- Validation level: `FULL_REBUILD`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Current pushed HEAD before this replan: `4e46bc6971049823ddd73977e68665ba108b77a3`

## Why This Replan Exists

Launch was aborted because the setup wizard asks a noob VPS operator for an `OpenClaw token`. This is unacceptable for the target launch experience. The next implementation must replace that token prompt with OpenClaw gateway detection/bootstrap and only expose webhook token references as optional advanced configuration.

## Planning Artifacts Added

- `57-openclaw-bootstrap-problem-framing.md`
- `58-openclaw-bootstrap-options-and-recommendation.md`
- `59-phase-5-revision-openclaw-bootstrap.md`
- `60-openclaw-bootstrap-worker-handoff.md`

## Recommended Direction

Implement the recommended Option C from the planning artifacts:

- detect an existing OpenClaw gateway through OpenClaw-supported CLI/gateway mechanisms
- offer install/onboarding when OpenClaw is absent
- let OpenClaw generate/store its own gateway auth
- remove `OPENCLAW_TOKEN` as a default fresh-VPS launch blocker
- keep advanced webhook token mode optional

## Required Validation For The Worker

```bash
npm run verify
npm run full-rebuild
```

Also run a deterministic setup proof showing no OpenClaw token prompt/flag is required, setup JSON remains references-only, and missing `OPENCLAW_TOKEN` alone is no longer the default blocker.

## QA Status

`READY_FOR_IMPLEMENTATION`
