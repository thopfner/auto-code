# Phase 5 Revision Required

BRIEF_ID: `2026-04-28-auto-forge-controller`
Updated: `2026-04-28T18:40:22Z`
Stop status: `REVISION_PACK_REQUIRED`

## Phase Reviewed

- `50-phase-5-e2e-hardening.md`
- New revision authorized: `55-phase-5-revision-vps-setup-wizard.md`

## Finding

Phase 5 exposed a plan gap: the product still expects the operator to manually export or wire live OpenClaw, Telegram, and OpenAI/Codex settings before final smoke. The user requirement is stronger: a fresh VPS should support a guided setup path that configures Nginx, collects or references secrets, handles Codex auth, helps discover Telegram chat ID, writes setup state, and runs live validation.

Finding type: `plan_gap`.

## Required Revision

Implement `55-phase-5-revision-vps-setup-wizard.md`.

The revision must add a concrete command or script that a fresh VPS operator can run after clone/bootstrap. Manual OpenClaw settings entry is acceptable only if no OpenClaw settings mutation API is available; in that case, the command must print exact values and resume validation after operator confirmation.

## Current Branch And Repo

- Repo path: `/var/www/html/auto.thapi.cc`
- Branch: `main`
- Current pushed HEAD before this revision pack: `672cbf58371cc45a5b0bb6a78a6452fe8bfb0883`
- QA revision-pack commit SHA: `9d1a8302e7dab7fb5d80aa1f723a2fbcbfe1526d`

## QA Status

`REVISION_PACK_REQUIRED`
