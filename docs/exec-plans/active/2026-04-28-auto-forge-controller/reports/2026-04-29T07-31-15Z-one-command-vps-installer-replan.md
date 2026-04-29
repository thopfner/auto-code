# Phase 5 One-Command VPS Installer Replan

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-29T07:31:15Z`
Stop status: `READY_FOR_IMPLEMENTATION`

## Phase Authorized

- `72-phase-5-revision-one-command-vps-installer.md`
- Execution mode: `FINAL_SHIPGATE_REVISION`
- Validation level: `FULL_REBUILD`

## Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Current pushed HEAD before this replan: `a07e38b8113d797c9a0d852c44e230d719f72018`

## Why This Replan Exists

Fresh launch testing showed the current deployment path still asks the operator to run infrastructure commands manually: chmod, Docker Compose, nginx config, Certbot/TLS, and smoke checks. That does not match the target SaaS-owner/customer setup experience.

## Planning Artifacts Added

- `70-one-command-vps-installer-problem-framing.md`
- `71-one-command-vps-installer-options-and-recommendation.md`
- `72-phase-5-revision-one-command-vps-installer.md`
- `73-one-command-vps-installer-worker-handoff.md`

## Recommended Direction

Implement a true one-command VPS installer:

- can run through `curl | sudo bash` or from a cloned repo
- installs/verifies prerequisites
- clones/updates `/opt/auto-forge-controller`
- creates `/etc/auto-forge-controller/auto-forge.env` with mode `0600`
- runs setup against the same runtime env/setup state used by Compose services
- builds and starts Docker Compose services
- installs/reloads nginx
- optionally runs Certbot for HTTPS when DNS is ready
- runs health and smoke checks
- prints one clear final status

## Required Validation For The Worker

```bash
bash -n scripts/install-vps.sh
npm run test -- --run tests/vps-installer.test.ts tests/vps-setup-wizard.test.ts
npm run verify
npm run full-rebuild
AUTO_FORGE_INSTALL_DRY_RUN=1 AUTO_FORGE_PUBLIC_BASE_URL=https://forge.example.com TELEGRAM_BOT_TOKEN=redacted-test-telegram-token OPENAI_API_KEY=redacted-test-openai-key bash scripts/install-vps.sh --dry-run
```

The dry-run proof must not print the supplied raw token/key values.

If live credentials, DNS, TLS, or OpenClaw are unavailable, the worker may stop as `BLOCKED_EXTERNAL` only after deterministic installer and full-rebuild proof pass.

## QA Status

`READY_FOR_IMPLEMENTATION`
