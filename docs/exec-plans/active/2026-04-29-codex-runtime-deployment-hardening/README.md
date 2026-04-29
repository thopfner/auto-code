# Codex Runtime Deployment Hardening Brief

Brief ID: `2026-04-29-codex-runtime-deployment-hardening`
Brief type: `brief-full`
Branch: `main`
Initial read mode: `FULL_REHYDRATE`
Current authorized execution window: `30-phase-3-vps-telegram-proof.md` only
Current stop gate: `QA_CHECKPOINT`

## Objective

Repair the deployed VPS runtime path so Telegram-triggered Codex workflows can initialize reliably inside Docker, persist their prompts and runner artifacts on host-mounted storage, and report actionable redacted failures to Telegram and logs.

## Desired Outcome

- `codex exec` runs inside the API/runner container with a writable active `CODEX_HOME`.
- OAuth mode keeps the host Codex auth cache protected and never exposes raw credentials, while runtime session/cache/log state writes to `/data`.
- API-key mode also gets a writable `CODEX_HOME` for Codex session/log/cache files.
- Runner prompts and artifacts persist under the Compose data mount, not the container writable layer.
- A failed runner sends a useful redacted blocker summary instead of only `codex exec exited with 1`.
- Host and container health checks agree about setup/log/artifact paths.
- Installer live-smoke behavior is explicit enough that operators and automation cannot mistake a blocked external proof for a fully verified production deployment.
- A follow-up Postgres durability pack is preserved as required future work, but not mixed into this emergency deployment repair.

## Deployment Topology

- `/var/www/html/auto.thapi.cc` is the source/dev checkout for this brief.
- Product deployment happens by pushing `main` to GitHub and pulling that commit into the target install, commonly `/opt/auto-forge-controller` on the deployment VPS.
- Local Docker Compose commands in this source checkout are disposable validation only. They may prove build/runtime wiring, but they must use alternate ports when needed and be cleaned down after proof.
- `SERVICE_RESTART` in this source checkout does not mean keeping API/worker/web running here as the product. It means service-scoped disposable validation only.
- Deployed-service restart, live Telegram/OpenClaw/Codex proof, nginx/systemd proof, and go-live claims must run on the target deployed checkout after it has pulled the pushed GitHub commit.
- If an agent is unsure whether a command targets the source/dev checkout or the deployed target install, it must stop and ask before restarting services.

## Production-Grade Acceptance Bar

The bar is derived from repo conventions, the active project memory, Docker primary-source storage guidance, and OpenAI Codex primary-source CLI/auth documentation.

Production-grade means this batch:

- does not use a read-only bind mount as active `CODEX_HOME`
- separates read-only auth-source material from writable runtime state
- keeps Codex credential files and auth caches out of Git, setup JSON, Telegram, reports, and ordinary logs
- sets writable Codex runtime directories to restrictive permissions where the implementation controls them
- persists prompts, runner logs, and artifacts through the existing Compose data mount
- gives operators enough redacted failure context to resolve common deployment/Codex/auth/path failures
- updates installer, Compose, docs, tests, and health behavior together so the deployment contract is coherent
- proves the fix with targeted tests, `npm run verify`, Docker Compose rebuild/start/log evidence, and a Telegram `/scope @auto-forge-controller ...` VPS smoke
- does not claim durable workflow/queue production readiness until the separate Postgres orchestration pack is implemented

Shortcuts explicitly forbidden:

- copying raw auth cache contents into setup JSON or reports
- making `/root/.codex` writable by mounting the host auth cache read-write as the active runtime home
- burying the real runner error in container-only artifacts
- treating missing live smoke credentials as success without a clear `BLOCKED_EXTERNAL` or hard-gate decision
- bundling a partial Postgres workflow-store rewrite into this repair batch

## Core Invariants

- Auto Forge owns Telegram inbound webhook traffic at `/telegram/webhook`.
- Secrets remain references-only outside installer-managed env files and protected auth-cache locations.
- No duplicate repo folders or `git worktree` directories are authorized.
- The live branch must remain usable at every checkpoint.
- The source/dev checkout must not be converted into the long-lived deployed runtime by validation commands.
- `QA_CHECKPOINT` and `FINAL_SHIPGATE` are external review gates and may not be self-cleared by the coding agent.
- `tools/forge/__pycache__/` was pre-existing untracked state during planning and is not owned by this brief.

## Read For Context

- `AGENTS.md`
- `CLAUDE.md`
- `docs/agent-memory/PROJECT.md`
- `docs/agent-memory/ARCHITECTURE.md`
- `docs/agent-memory/DECISIONS.md`
- `docs/agent-memory/CURRENT_STATE.md`
- `docs/agent-memory/TESTING.md`
- this brief's `00-problem-framing.md`
- this brief's `01-brief-lineage-and-sources.md`
- this brief's `03-root-cause-or-audit.md`
- the currently authorized phase file

## Execute Now

Phase 1 was cleared by QA on `2026-04-29T21:24:15Z`.
Phase 2 was cleared by QA on `2026-04-29T21:41:45Z`.

Only execute:

- `30-phase-3-vps-telegram-proof.md`

Later phases are context only until QA clears Phase 3 or a new handoff explicitly authorizes the next window.

## Required Stop Behavior

At every QA checkpoint, final shipgate, or blocker stop:

- write a timestamped Markdown report under `reports/`
- refresh `reports/LATEST.md`
- refresh `reports/LATEST.json` to point at the newest stop report
- update `automation/state.json` only enough to stop advertising stale status
- include `Durable memory candidates`
- commit and push unless the brief or repo policy explicitly blocks pushing
- report branch, files changed, tests run, `implementation_commit_sha`, `stop_report_commit_sha`, and push status

## Follow-Up Pack Required

After this runtime repair is proven on the VPS, create a separate Postgres durability/orchestration pack. That pack should move workflow state out of `MemoryWorkflowStore`, make the worker consume durable queue/work items, define retry/recovery semantics in Postgres, and reconcile API/worker ownership. It is intentionally excluded from this repair batch so the current Telegram/Codex deployment blocker can be fixed without mixing in schema and queue migration risk.
