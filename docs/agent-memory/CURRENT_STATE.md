# Auto Forge Controller Current State

Last refreshed: 2026-04-28

## Current Branch

- `main`

## Active Work

- New product repo initialized at `/var/www/html/auto.thapi.cc`.
- Repo-local Auto Forge skills named `auto-forge-*` exist under `.agents/skills/forge-*` plus shared references under `.agents/skills/references/`.
- Active execution brief: `docs/exec-plans/active/2026-04-28-auto-forge-controller/`.
- Phase 4 implementation and health/log revision are cleared.
- Current authorized window: `50-phase-5-e2e-hardening.md`.

## Recently Completed

- Created repo-local memory pack and UI docs.
- Captured the approved architecture direction: custom Forge Controller with Telegram/OpenClaw as the interface layer.
- Added service skeletons for API, worker, web, and CLI; core task state machine; repo locks; runner and operator gateway interfaces; fake runner/OpenClaw adapters; initial SQL migration; and unit/config/schema checks.
- Added setup API endpoints, first-run onboarding UI, Telegram Bot API adapter, OpenClaw gateway adapter, secret-reference setup persistence, and tests for onboarding/API/adapters.
- Added the Forge workflow engine for `/scope`, clarification pause/resume, planning approval, worker dispatch, QA routing, revision/replan/block/complete outcomes, cancellation, and runner retry.
- Added the Codex CLI runner adapter for `codex-cli 0.125.0`, prompt builder, in-memory workflow store, artifact watcher, Telegram approval/resume API endpoints, and worker startup wiring.
- Corrected Phase 3 revision issues: Codex runner uses `--config approval_policy="..."`, artifact-derived QA outcomes enforce required full commit SHAs, and `REVISION_PACK_REQUIRED` routes to worker revision.
- Added Docker Compose services for Postgres/API/worker/web, systemd API/worker unit templates, `scripts/bootstrap.sh`, deployment runbooks, ops CLI commands, health checks, worker heartbeat, references-only backup/restore, recovery logging, and task/service log discovery.
- Corrected Phase 4 revision issues: health reports API, web, worker, database, OpenClaw, and Codex checks; service logs are discoverable for API, worker, web, and Postgres.

## Known Risks

- Production persistence and full live end-to-end closeout remain Phase 5 work.
- Production auth handling needs careful implementation because Codex auth caches and Telegram/OpenClaw secrets are sensitive.
- Real OpenClaw and Telegram smoke checks require credentials and must be addressed at final shipgate or explicitly blocked as external.

## Next Best Step

- Execute Phase 5 for end-to-end hardening, live or staged Telegram/OpenClaw smoke, real Codex runner proof, fixture repo Forge lifecycle, final QA, memory update, and brief archive.
