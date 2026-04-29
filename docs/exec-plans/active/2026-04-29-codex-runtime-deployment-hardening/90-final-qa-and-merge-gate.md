# Final QA And Shipgate

Execution mode: `FINAL_SHIPGATE`
Validation level: `FULL_REBUILD`
Authorization status: blocked until Phase 3 QA clearance

## QA Must Verify

- `CODEX_HOME` is writable inside production containers.
- OAuth auth-source material is not mounted read-write as active runtime home.
- API-key auth mode still works.
- Prompts and artifacts persist under host-mounted data.
- Runner failure messages include useful redacted summaries.
- Host and container health checks report setup state truthfully.
- Installer live-smoke behavior is explicit and documented.
- `npm run verify` passes on current HEAD.
- Docker Compose build/start/log proof passes.
- Telegram `/scope @auto-forge-controller ...` no longer fails due to read-only Codex session initialization.
- Reports and machine-readable automation metadata contain truthful full 40-character SHAs.

## Required Commands

```bash
npm run verify
docker compose build
docker compose up -d postgres api worker web
docker compose logs --tail=100 api
docker compose logs --tail=100 worker
```

Live/staged:

```bash
npm run live:smoke
```

If live external values are unavailable, final status must remain `BLOCKED_EXTERNAL`.

## Durable Memory And Archive

At final shipgate:

- update `docs/agent-memory/CURRENT_STATE.md` for the repaired Codex runtime/deployment status
- update `docs/agent-memory/ARCHITECTURE.md` for the Codex runtime home, auth-source, artifact, and prompt persistence contracts
- update `docs/agent-memory/DECISIONS.md` if a durable installer live-smoke semantics decision is made
- update `docs/agent-memory/TESTING.md` if verification commands changed
- preserve a durable memory candidate for the required Postgres workflow/queue durability follow-up pack
- archive this accepted brief to `docs/exec-plans/completed/2026-04-29-codex-runtime-deployment-hardening/`

## Gate

Final clearance requires external QA approval. Do not self-clear.
