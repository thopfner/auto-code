# Auto Forge Controller Current State

Last refreshed: 2026-04-28

## Current Branch

- `main`

## Active Work

- New product repo initialized at `/var/www/html/auto.thapi.cc`.
- Repo-local Auto Forge skills named `auto-forge-*` exist under `.agents/skills/forge-*` plus shared references under `.agents/skills/references/`.
- Active execution brief: `docs/exec-plans/active/2026-04-28-auto-forge-controller/`.
- Phase 3 implementation and revision are cleared.
- Current authorized window: `40-phase-4-portability-ops.md`.

## Recently Completed

- Created repo-local memory pack and UI docs.
- Captured the approved architecture direction: custom Forge Controller with Telegram/OpenClaw as the interface layer.
- Added service skeletons for API, worker, web, and CLI; core task state machine; repo locks; runner and operator gateway interfaces; fake runner/OpenClaw adapters; initial SQL migration; and unit/config/schema checks.
- Added setup API endpoints, first-run onboarding UI, Telegram Bot API adapter, OpenClaw gateway adapter, secret-reference setup persistence, and tests for onboarding/API/adapters.
- Added the Forge workflow engine for `/scope`, clarification pause/resume, planning approval, worker dispatch, QA routing, revision/replan/block/complete outcomes, cancellation, and runner retry.
- Added the Codex CLI runner adapter for `codex-cli 0.125.0`, prompt builder, in-memory workflow store, artifact watcher, Telegram approval/resume API endpoints, and worker startup wiring.
- Corrected Phase 3 revision issues: Codex runner uses `--config approval_policy="..."`, artifact-derived QA outcomes enforce required full commit SHAs, and `REVISION_PACK_REQUIRED` routes to worker revision.

## Known Risks

- Production persistence, queue hardening, deployment packaging, backup/restore, and recovery flows are still Phase 4/5 work.
- Production auth handling needs careful implementation because Codex auth caches and Telegram/OpenClaw secrets are sensitive.
- Real OpenClaw and Telegram smoke checks require credentials and remain later-phase validation.

## Next Best Step

- Execute Phase 4 for portability, deployment, operations, backup/restore, health checks, and recovery.
