# Phase 3 - VPS Telegram Proof

Execution mode: `QA_CHECKPOINT`
Validation level: `FULL_REBUILD`
Authorization status: authorized after Phase 2 QA clearance

## Goal

Prove the repaired deployment on the test VPS with a real Telegram-triggered Codex workflow and persisted artifacts.

This phase is target-deployment proof, not source/dev proof. Before running the commands below, push the accepted source commit to GitHub and pull that exact commit into the target install path.

## Required VPS Proof

On `/opt/auto-forge-controller` or the operator-approved target VPS repo path:

```bash
git status --short
npm run verify
docker compose build
docker compose up -d postgres api worker web
docker compose logs --tail=100 api
docker compose logs --tail=100 worker
```

Then from Telegram:

```text
/scope @auto-forge-controller add a docs only note explaining this is a vps smoke test. stop after planning and QA
```

Acceptance evidence:

- Target checkout HEAD matches the accepted pushed GitHub commit being tested.
- Telegram no longer reports only `codex exec exited with 1`.
- Codex runner can initialize a session inside the API/runner container.
- If the task intentionally stops after planning/QA, the stop reason is workflow-appropriate, not a read-only filesystem crash.
- Runner artifacts are persisted under `/data/artifacts` or the configured host-mounted equivalent.
- Prompts are persisted under `/data/prompts` or the configured host-mounted equivalent.
- A forced or observed runner failure includes a useful redacted Telegram summary.
- `docker compose logs --tail=100 api` shows no secret leakage.
- Host-side inspection can find the persisted artifact files through the Compose data directory.

## Non-Goals

- Do not mark the older OpenClaw/repo-management final shipgate clear from this proof alone.
- Do not implement Postgres durable queue work.
- Do not archive this brief until final QA completes.

## Gate

Stop at `QA_CHECKPOINT`. External QA decides whether this is enough to proceed to final shipgate or whether a revision pack is required.
