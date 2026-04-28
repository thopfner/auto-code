# Auto Forge Controller Current State

Last refreshed: 2026-04-28

## Current Branch

- `main`

## Active Work

- New product repo initialized at `/var/www/html/auto.thapi.cc`.
- Repo-local Auto Forge skills named `auto-forge-*` exist under `.agents/skills/forge-*` plus shared references under `.agents/skills/references/`.
- Active execution brief: `docs/exec-plans/active/2026-04-28-auto-forge-controller/`.
- Phase 2 implementation added Telegram/OpenClaw onboarding and is cleared for the next phase.

## Recently Completed

- Created repo-local memory pack and UI docs.
- Captured the approved architecture direction: custom Forge Controller with Telegram/OpenClaw as the interface layer.
- Added service skeletons for API, worker, web, and CLI; core task state machine; repo locks; runner and operator gateway interfaces; fake runner/OpenClaw adapters; initial SQL migration; and unit/config/schema checks.
- Added setup API endpoints, first-run onboarding UI, Telegram Bot API adapter, OpenClaw gateway adapter, secret-reference setup persistence, and tests for onboarding/API/adapters.

## Known Risks

- The active brief must verify the exact Codex runner path with live CLI/SDK behavior before committing to one implementation adapter.
- Production auth handling needs careful implementation because Codex auth caches and Telegram/OpenClaw secrets are sensitive.
- Real OpenClaw and Telegram smoke checks require credentials and were not available during Phase 2 QA.

## Next Best Step

- Execute Phase 3 for the Codex runner and Forge workflow engine.
