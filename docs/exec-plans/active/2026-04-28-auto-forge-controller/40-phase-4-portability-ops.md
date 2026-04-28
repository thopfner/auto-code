# Phase 4 - Portability And Operations

Execution mode: `QA_CHECKPOINT`
Validation level: `FULL_REBUILD`

## Goal

Make the product deployable and portable across local desktop and VPS installs.

## Owned Modules

- Docker Compose.
- systemd units or install templates.
- bootstrap/install command.
- backup/restore.
- health checks.
- admin CLI.
- deployment documentation.

## Required Behavior

- Fresh clone can bootstrap locally.
- Fresh VPS can bootstrap with documented prerequisites.
- Operator can export/import configuration without secrets leakage.
- Service health exposes web/API/worker/DB/OpenClaw/Codex status.
- Stuck task recovery is documented and implemented.
- Logs are discoverable per task and service.

## Required Tests

- Docker Compose build and smoke.
- CLI health command.
- Backup/restore dry run.
- Install documentation dry run on a clean path or disposable environment.

## Gate

Stop for QA after deployment and recovery paths are tested.

