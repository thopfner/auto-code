# Auto Forge Controller Testing Memory

Last refreshed: 2026-04-29

## Fast Checks

- `git status --short`
- `npm run lint`
- `npm run typecheck`
- `npm run schema:check`
- `npm run test`
- `npm run verify`
- `npm run full-rebuild`
- `npm run live:smoke`

## Topology Rules For Runtime Validation

- `/var/www/html/auto.thapi.cc` is the source/dev checkout. Local Docker Compose checks here are disposable validation harnesses only.
- Use alternate ports for local Compose validation when needed, and clean the stack down after proof.
- Do not leave API, worker, web, nginx, systemd, or Docker services running on this dev checkout as if it were the deployed product.
- For deployed-product proof, first push the source branch to GitHub, then pull that commit into the target install, commonly `/opt/auto-forge-controller` on the deployment VPS.
- `SERVICE_RESTART` means service-scoped proof at the appropriate topology layer. In the dev checkout it means disposable service-scoped validation only; on the deployment VPS it means restarting/recreating the target install services.
- `FULL_REBUILD` in the dev checkout is not go-live proof by itself. Final go-live claims require target install validation plus live/staged external checks when the brief requires them.

## Phase 1 Verification

Run from `/var/www/html/auto.thapi.cc`:

```bash
npm run verify
```

`npm run verify` runs ESLint, TypeScript typechecking, SQL migration schema checks, and Vitest unit tests for the state machine, repo locks, fake runner/operator adapters, and config validation.

## Phase 2 Verification

Run from `/var/www/html/auto.thapi.cc`:

```bash
npm run verify
```

Phase 2 also supports a lightweight live reload smoke:

```bash
PORT=3100 npm run dev:api
VITE_API_BASE_URL=http://127.0.0.1:3100 npm run dev:web -- --host 127.0.0.1 --port 5174
```

QA verified API health, Telegram command metadata, setup status, and Vite serving the onboarding app. Live OpenClaw/Telegram validation still requires credentials.

## Phase 3 Verification

Run from `/var/www/html/auto.thapi.cc`:

```bash
npm run verify
```

Phase 3 revision QA verified:

- `npm run verify` passes ESLint, TypeScript, schema check, and Vitest with 11 files and 38 tests.
- `CodexCliRunner.run()` works with installed `codex-cli 0.125.0` using `codex exec --config approval_policy="..."`.
- The real Codex runner smoke was executed in read-only mode and returned `AUTO_FORGE_QA_SMOKE_OK`.
- Artifact validation enforces full 40-character implementation and stop-report commit SHAs.
- Artifact QA status mapping covers `CLEAR_CURRENT_PHASE`, `REVISION_PACK_REQUIRED`, `REPLAN_REQUIRED`, and `BLOCKED_EXTERNAL`.
- API service smoke passed on `/health`, `/setup`, and `/setup/telegram-commands`.
- Worker service smoke started `auto-forge-worker` with runner `codex-cli`.

## Phase 4 Verification

Run from `/var/www/html/auto.thapi.cc`:

```bash
npm run verify
npm run ops:health
npm run ops:backup -- --dry-run
npm run ops:restore -- --input <backup.json> --dry-run
npm run ops:recover -- --action list-stuck --dry-run
npm run auto-forge -- logs --task <task-id>
npm run auto-forge -- logs --service api
npm run auto-forge -- logs --service worker
npm run auto-forge -- logs --service web
npm run auto-forge -- logs --service postgres
docker compose build
AUTO_FORGE_API_PORT=<free-port> AUTO_FORGE_WEB_PORT=<free-port> docker compose up -d postgres api worker web
AUTO_FORGE_API_PORT=<same-free-port> AUTO_FORGE_WEB_PORT=<same-free-port> docker compose -f docker-compose.yml -f docker-compose.smoke.yml run --rm smoke
docker compose down --remove-orphans
```

Phase 4 revision QA verified:

- `npm run verify` passes ESLint, TypeScript, schema check, and Vitest with 12 files and 43 tests.
- Local health includes `api`, `web`, `worker`, `database`, `openclaw`, and `codex` checks.
- Docker Compose smoke reports API and web as passed through service DNS.
- Service-log discovery returns local npm paths plus Docker Compose commands for API, worker, web, and Postgres, and systemd journal commands for API and worker.
- References-only backup/restore dry runs avoid raw secret export.
- Compose build and runtime smoke passed on alternate ports, and the stack was cleaned down afterward.

## Full Verification

Run from `/var/www/html/auto.thapi.cc`:

```bash
npm run full-rebuild
npm run live:smoke
```

`npm run full-rebuild` runs the local fresh bootstrap path, `npm run verify`, install-check, health, backup/restore, recovery, task/service log discovery, Docker Compose build, Docker Compose runtime startup, Compose smoke, and Compose cleanup. The bootstrap and Docker build paths assert that the repo-managed Codex CLI exists at `node_modules/.bin/codex`.

`npm run live:smoke` is the live or staged external gate. It validates Telegram Bot API identity/commands/outbound delivery, OpenClaw health, optional OpenClaw CLI Telegram delivery, and a real Codex CLI runner smoke when credentials are present. If required credentials are missing it exits non-zero with `BLOCKED_EXTERNAL` and the exact missing environment variables.

The final product verification command surface now covers:

- formatting or lint checks
- type checks
- unit tests
- integration tests for controller state transitions
- OpenClaw webhook contract tests
- Codex runner adapter smoke tests with a fake runner, sanitized-PATH managed binary resolution, and at least one real local smoke path
- web onboarding UI tests
- Docker Compose or deployment smoke checks
- service health and log discovery checks

## Runtime QA

Final shipgate must prove:

- fresh local install
- fresh VPS-style install
- OpenClaw gateway health
- Telegram command registration or documented BotFather setup
- `/scope` intake from Telegram
- scope clarification pause and resume
- planning approval pause and resume
- worker execution to QA stop
- QA revision or clearance path
- final closeout archive and memory update
- managed OpenClaw bootstrap files and no generic OpenClaw first-run takeover
- Auto Forge-owned Telegram webhook at `/telegram/webhook`
- Telegram repo registration, repo switching, and selected-repo `/scope` routing
- repo-scoped SSH key generation, GitHub deploy-key registration, SSH read proof, and SSH write dry-run proof
- target deployed checkout has pulled the accepted GitHub commit before service restart or live Telegram/Codex proof

## Test Data And Fixtures

- Use a disposable fixture repo for end-to-end tests.
- Use fake Telegram/OpenClaw/Codex adapters for deterministic CI.
- Use one real OpenClaw/Codex smoke run before declaring go-live readiness.

## Known Gaps

- Real OpenClaw, Telegram, GitHub deploy-key, and OpenAI Codex runner smoke requires `OPENCLAW_BASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_TEST_CHAT_ID`, and either `OPENAI_API_KEY` when `CODEX_AUTH_REF=env:OPENAI_API_KEY`, or a completed Codex OAuth device-auth cache when `CODEX_AUTH_REF=secret:codex-oauth-local-cache`; advanced webhook mode also requires `OPENCLAW_AUTH_REF`.
- Real GitHub deploy-key proof requires a disposable GitHub repository, an SSH remote such as `git@github.com:OWNER/REPO.git`, and `AUTO_FORGE_GITHUB_TOKEN` or `GITHUB_TOKEN` when API-based deploy-key setup is used. HTTPS remotes do not prove deploy-key access because `GIT_SSH_COMMAND` is ignored by HTTPS Git operations.
- The final external gate is still blocked without live or staged credentials, but Codex CLI installation is covered by `@openai/codex@0.125.0`, `scripts/bootstrap.sh`, `Dockerfile`, `npm run verify`, `npm run full-rebuild`, and sanitized-PATH runner and health checks.
