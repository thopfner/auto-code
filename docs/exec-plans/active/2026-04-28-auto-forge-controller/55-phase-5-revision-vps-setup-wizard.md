# Phase 5 Revision - Fresh VPS Setup Wizard

Execution mode: `FINAL_SHIPGATE_REVISION`
Validation level: `FULL_REBUILD`

## Why This Revision Exists

Phase 5 live smoke stopped at `BLOCKED_EXTERNAL` because the operator still has to manually discover and export the live OpenClaw, Telegram, and OpenAI/Codex values. The product goal is stronger: after a fresh clone on a VPS, the operator should be able to run one guided setup command that configures Nginx, writes local runtime settings, creates the controller setup record, validates Telegram/OpenClaw/Codex, and then runs live smoke.

This is a plan-gap revision. Do not treat it as optional documentation polish.

## Required Behavior

- Add a fresh-VPS setup wizard command or script that can be run after clone/bootstrap.
- The wizard must be safe to rerun and must not commit secrets.
- It must ask for:
  - public domain or base URL for the controller
  - whether to configure Nginx automatically
  - API upstream port
  - web upstream port
  - OpenClaw gateway base URL
  - OpenClaw token value or environment reference
  - Telegram bot token value or environment reference
  - Telegram chat ID, with a helper path to discover it from `getUpdates`
  - Codex auth mode: API key env ref by default, with an explicit OAuth/manual-login option only when the operator accepts trusted-machine constraints
- It must write secret values only to an ignored local environment file or root-owned service env file, never into tracked files.
- It must generate or update the controller setup record using secret references only.
- It must be able to install or print an Nginx site config that routes:
  - `/` to the web service
  - `/health`, `/live`, `/setup`, `/telegram/command`, `/approvals/*`, and workflow/API paths to the API service
- It must optionally test and reload Nginx when run with sufficient privileges.
- It must trigger or guide Codex authentication:
  - default path: set `OPENAI_API_KEY` and use `CODEX_AUTH_REF=env:OPENAI_API_KEY`
  - OAuth path: call out to `codex login` or equivalent interactive login and verify `codex --version` plus a read-only smoke, without copying auth caches into Git
- It must run the same validation path used by final QA:
  - setup validation
  - Telegram bot identity and outbound test message
  - OpenClaw health and routed Telegram delivery
  - Codex runner smoke
  - `npm run live:smoke`

## Required Implementation Targets

Prefer TypeScript for controller-aware logic and Bash only for OS-level setup wrappers.

Add or update these surfaces:

- `package.json`
  - Add a first-class script such as `npm run setup:vps` or `npm run onboarding:cli`.
- `tools/`
  - Add the interactive setup wizard entry point.
  - Reuse existing setup validation from `apps/api/src/server.ts` and adapters from `packages/adapters/src`.
- `scripts/`
  - Add an OS-level wrapper only if needed for Nginx package/config/reload actions.
- `packages/ops/src/`
  - Put reusable Nginx config generation, env-file writing, chat-ID discovery, and setup-record helpers here if they need tests.
- `apps/cli/src/index.ts`
  - Expose the setup wizard through the existing CLI if that fits the current command shape.
- `docs/deployment/README.md`
- `docs/deployment/vps.md`
- `.env.example`
  - Document all values used by the wizard without adding real secrets.
- `tests/`
  - Add deterministic tests for wizard config generation and secret-reference persistence.
  - Add tests that verify secrets are not written into setup JSON or generated docs.
  - Add tests for Nginx route generation.

## Nginx Acceptance Contract

The generated Nginx config must be deterministic and reviewable in tests. It must include:

- server name from operator input
- web upstream defaulting to `127.0.0.1:5173`
- API upstream defaulting to `127.0.0.1:3000`
- reverse proxy headers for host, forwarded proto, and client IP
- API routes for current controller endpoints
- an explicit note that TLS should be handled by Certbot or an existing VPS TLS manager before Telegram webhook production use

The wizard may support HTTP-only first boot, but it must tell the operator when HTTPS is required for Telegram webhook production use.

## Secret Handling Rules

- Do not write raw tokens to `.auto-forge/setup.json`.
- Do not write raw tokens to reports, logs, generated Nginx config, or tracked docs.
- If writing `/etc/auto-forge-controller/auto-forge.env`, use `0600` permissions and root-owned or service-user-owned file mode.
- If writing repo-local `.env`, keep mode `0600`; it is already ignored.
- Backup/restore must remain references-only.
- OAuth/ChatGPT auth caches are sensitive; never copy them into the repo or backup bundle.

## OpenClaw Settings Guidance

The wizard cannot configure a third-party OpenClaw instance unless the OpenClaw API supports the specific setting mutation. Therefore it must do one of these:

1. if an OpenClaw settings API is already available in the repo or documented integration, call it with explicit validation and error output; or
2. print the exact values the operator must paste into OpenClaw settings and then validate the gateway after the operator confirms.

Do not fake OpenClaw settings mutation. If mutation is not available, make the manual OpenClaw step explicit and minimal.

## Required Tests

Run and report:

```bash
npm run verify
npm run full-rebuild
```

If live credentials are available after the wizard is complete, also run:

```bash
npm run setup:vps
npm run live:smoke
```

If live credentials are not available in the worker shell, the worker must still prove the deterministic wizard behavior and stop with `BLOCKED_EXTERNAL` only for the live external smoke.

## Completion Report

Write a timestamped report under `reports/`, refresh `reports/LATEST.md`, refresh `reports/LATEST.json`, update `automation/state.json`, and push.

The report must include:

- exact setup command name
- files changed
- whether Nginx was actually configured or dry-run generated
- where secrets are written
- how Telegram chat ID discovery works
- how OpenClaw settings are handled
- how Codex auth is handled
- tests run
- exact implementation commit SHA
- exact stop report commit SHA

## Stop Conditions

Stop and report instead of improvising if:

- Nginx is not installed and package installation is not permitted.
- The VPS has an existing conflicting Nginx site for the same domain.
- OpenClaw settings mutation is not possible and the operator must paste settings manually.
- Codex OAuth requires browser interaction that cannot be completed in the worker shell.
- Live Telegram/OpenClaw/OpenAI credentials are unavailable.

## QA Gate

After this revision lands, final QA must verify that a fresh VPS operator has a concrete command to run instead of hand-exporting all live-smoke variables.

Final clearance still requires `50-phase-5-e2e-hardening.md`, `90-final-qa-and-merge-gate.md`, and `99-memory-pack-update.md`.
