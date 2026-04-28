# Auto Forge Controller Current State

Last refreshed: 2026-04-28

## Current Branch

- `main`

## Active Work

- New product repo initialized at `/var/www/html/auto.thapi.cc`.
- Repo-local Auto Forge skills named `auto-forge-*` exist under `.agents/skills/forge-*` plus shared references under `.agents/skills/references/`.
- Active execution brief: `docs/exec-plans/active/2026-04-28-auto-forge-controller/`.
- Phase 1 implementation created the TypeScript/npm controller foundation and is waiting for QA checkpoint review.

## Recently Completed

- Created repo-local memory pack and UI docs.
- Captured the approved architecture direction: custom Forge Controller with Telegram/OpenClaw as the interface layer.
- Added service skeletons for API, worker, web, and CLI; core task state machine; repo locks; runner and operator gateway interfaces; fake runner/OpenClaw adapters; initial SQL migration; and unit/config/schema checks.

## Known Risks

- The active brief must verify the exact Codex runner path with live CLI/SDK behavior before committing to one implementation adapter.
- Production auth handling needs careful implementation because Codex auth caches and Telegram/OpenClaw secrets are sensitive.
- The current web UI is a foundation screen only; full onboarding and operational views belong to later authorized phases.

## Next Best Step

- Run QA for Phase 1. If cleared, authorize Phase 2 for onboarding and OpenClaw/Telegram integration.
