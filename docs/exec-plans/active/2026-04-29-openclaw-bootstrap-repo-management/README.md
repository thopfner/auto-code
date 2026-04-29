# OpenClaw Bootstrap And Repo Management Brief

Brief ID: `2026-04-29-openclaw-bootstrap-repo-management`
Brief type: `brief-full`
Branch: `main`
Initial read mode: `FULL_REHYDRATE`
Initial authorized execution window: `10-phase-1-managed-openclaw-bootstrap.md` only
Initial stop gate: `QA_CHECKPOINT`

## Objective

Make the fresh VPS install feel like a product launch path, not a collection of manual OpenClaw, Telegram, Git, and SSH chores.

The immediate implementation slice is to add a managed OpenClaw bootstrap script that the VPS installer calls automatically. It must create and maintain the core OpenClaw workspace `.md` files and initial OpenClaw settings so the first OpenClaw message does not fall back into generic bootstrap/default programming.

## Desired Outcome

- A fresh VPS operator can run the installer and get a pre-shaped OpenClaw gateway/persona/workspace without manually editing OpenClaw files.
- Auto Forge remains the owner of Telegram inbound webhook traffic.
- OpenClaw is treated as a local gateway/helper unless a later phase explicitly designs a separate bot or mediated chat path.
- The public URL remains deployment-provided, not hardcoded to `hopfner.dev`.
- Later phases add safe Telegram repo switching and repo-scoped GitHub SSH key automation without being forgotten or implemented in a risky bundle.

## In Scope

Phase 1, authorized now:

- Add a standalone managed OpenClaw bootstrap script and supporting TypeScript/template code.
- Integrate that script into `scripts/install-vps.sh`.
- Create deterministic OpenClaw workspace markdown files.
- Set OpenClaw config through supported CLI paths where possible and validate the resulting config.
- Prevent OpenClaw first-run bootstrap from taking over the operator experience when the managed files are already present.
- Preserve the working Telegram webhook, live smoke, Codex OAuth/API-key behavior, and installer rerun behavior.

Later phases, context only until separately authorized:

- Telegram-safe repo registry and active repo switching.
- GitHub SSH deploy-key generation and validation.
- Optional GitHub deploy-key API integration when a suitably scoped GitHub token is available.
- Final full integration proof across fresh install, OpenClaw bootstrap, Telegram commands, repo switching, and SSH access.

## Explicit Non-Goals

- Do not mutate `/opt/forge-skills`.
- Do not make OpenClaw own the same Telegram bot inbound path as Auto Forge.
- Do not implement arbitrary filesystem path switching from Telegram.
- Do not expose private SSH keys over Telegram, logs, setup JSON, reports, or API responses.
- Do not require the user to manually edit runtime env files for this feature.
- Do not combine repo switching and SSH automation into Phase 1.
- Do not create duplicate repo checkouts or `git worktree` directories.

## Production-Grade Acceptance Bar

The bar comes from repo conventions plus OpenClaw and GitHub primary-source docs.

Production-grade means the implementation:

- keeps Auto Forge's currently working install/live-smoke flow intact
- uses OpenClaw's documented workspace/config concepts instead of ad hoc hidden state
- validates OpenClaw config before starting or restarting the gateway
- fails closed with actionable installer output when OpenClaw cannot be configured
- keeps setup JSON references-only
- keeps Telegram webhook ownership deterministic
- adds focused tests for the risky seams it changes
- runs `npm run verify` and `npm run full-rebuild` before any QA checkpoint

## Core Invariants

- One Telegram bot must have one inbound owner. Auto Forge owns the bot webhook at `${PUBLIC_BASE_URL}/telegram/webhook`.
- OpenClaw should not long-poll or set a webhook on the same Telegram bot in Phase 1.
- `hopfner.dev` is not hardcoded. The installer derives public URLs from `AUTO_FORGE_PUBLIC_BASE_URL` or the interactive prompt.
- The source repo default `https://github.com/thopfner/auto-code.git` remains only the installer source default and must stay overrideable through `AUTO_FORGE_REPO_URL`.
- Repo changes must respect per-repo locks and the active task queue.
- Secrets and private keys must stay on disk or in configured secret references, never in setup JSON.

## Read For Context

- `AGENTS.md`
- `CLAUDE.md`
- `docs/agent-memory/PROJECT.md`
- `docs/agent-memory/CURRENT_STATE.md`
- `docs/agent-memory/ARCHITECTURE.md`
- `docs/agent-memory/DECISIONS.md`
- `docs/agent-memory/TESTING.md`
- this brief's `01-brief-lineage-and-sources.md`
- this brief's `03-root-cause-or-audit.md`
- the currently authorized phase file

## Execute Now

Only execute:

- `10-phase-1-managed-openclaw-bootstrap.md`

Later phase files are context and product direction only. They are not implementation authorization until QA clears Phase 1 and a new handoff authorizes the next phase.

## Required Stop Behavior

At the Phase 1 QA checkpoint:

- write a timestamped report under this brief's `reports/`
- refresh `reports/LATEST.md`
- refresh `reports/LATEST.json`
- update `automation/state.json`
- update `automation/qa.json`
- commit and push
- report `implementation_commit_sha` and `stop_report_commit_sha`

