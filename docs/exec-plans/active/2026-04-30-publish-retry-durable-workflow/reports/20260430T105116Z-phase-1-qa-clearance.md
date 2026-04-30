# Phase 1 QA Clearance

- updated_at: `2026-04-30T10:51:16Z`
- qa_status: `CLEAR_CURRENT_PHASE`
- reviewed_phase: `10-phase-1-durable-store-health-proof.md`
- implementation_commit_sha: `a58e6321dd1ac1d789ebe285ce7baf0ec554a0ce`
- stop_report_commit_sha: `31be15f4fbb32efa794cc357619f6b0c257774e1`
- next_authorized_phase: `20-phase-2-publish-aware-retry.md`

## Findings

No implementation-blocking findings remain for Phase 1.

QA found one report-local validation issue and repaired the checkpoint truth in this report: the first source Compose check in this QA pass was running a stale pre-rebuild image. That stale image returned `404` for `GET /workflow/store`, used the old `Database URL configured for postgres` health message, and wrote a worker heartbeat without workflow-store metadata. After rebuilding the affected services with `docker compose up -d --build postgres api worker web`, the runtime matched the Phase 1 implementation.

This is not a code revision blocker. It is a validation-history correction: source code and rebuilt runtime now satisfy the Phase 1 contract, and the next target validation must use a rebuild/recreate path after pulling the accepted commit.

## Verification

```bash
npm run verify
npm run ops:health
AUTO_FORGE_API_PORT=3110 AUTO_FORGE_WEB_PORT=5180 docker compose up -d postgres api worker web
curl -s http://127.0.0.1:3110/workflow/store
curl -s http://127.0.0.1:3110/health
AUTO_FORGE_API_PORT=3110 AUTO_FORGE_WEB_PORT=5180 docker compose up -d --build postgres api worker web
curl -s http://127.0.0.1:3110/workflow/store
curl -s http://127.0.0.1:3110/health
docker compose exec -T worker sh -lc 'cat /data/worker-health.json'
docker compose exec -T postgres psql -U auto_forge -d auto_forge -v ON_ERROR_STOP=1 -c "<insert disposable qa-durable-task>"
curl -s http://127.0.0.1:3110/workflow/tasks
docker compose restart api
curl -s http://127.0.0.1:3110/workflow/tasks
docker compose down --remove-orphans --volumes
```

Results:

- `npm run verify`: passed lint, typecheck, schema check, and 134 tests.
- Host `npm run ops:health`: exited `0`; database mode reported `memory` because no host `DATABASE_URL` is configured in this source checkout.
- Stale-image check before rebuild: failed to prove Phase 1 runtime behavior, confirming the original source Compose evidence was incomplete.
- Rebuilt source Compose proof: passed. `GET /workflow/store` returned `mode: postgres`, `ready: true`, the sanitized `connectionFingerprint`, and all 11 workflow tables.
- API `/health` after rebuild reported database mode `postgres`, schema readiness, and worker heartbeat store metadata with the same fingerprint.
- Worker heartbeat after rebuild included `workflowStore.mode: postgres`, `databaseUrlConfigured: true`, and the same sanitized connection fingerprint.
- Disposable task `qa-durable-task` inserted into Postgres remained visible through `GET /workflow/tasks` before and after `docker compose restart api`.
- Disposable source Compose stack and Postgres volume were cleaned down.

Target deployed proof remains external to this source checkout because `/opt/auto-forge-controller` is not present here. The target install must pull `d8ed899b7685f689321223841c34bed3a1556298`, rebuild/recreate the affected Compose services, and rerun the Phase 1 target validation sequence before any go-live claim.

## Clearance

Phase 1 is cleared for the source implementation and rebuilt source runtime proof. Phase 2 is now authorized.

## Durable Memory Candidates

- For source Compose validation after TypeScript/runtime code changes, `docker compose up -d` alone can reuse stale images. Runtime proof must rebuild or recreate affected images before using endpoints or heartbeats as evidence.
- The deployed target must rebuild/recreate services after pulling a runtime code commit before claiming health or restart proof for that commit.
