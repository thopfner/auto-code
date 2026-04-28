# Phase 2 - OpenClaw, Telegram, And Onboarding

Execution mode: `QA_CHECKPOINT`
Validation level: `LIVE_RELOAD`

## Goal

Build the web onboarding experience and real OpenClaw/Telegram connection setup.

## Owned Modules

- Web onboarding UI.
- Controller API endpoints for setup.
- OpenClaw gateway adapter.
- Telegram command metadata and status notification adapter.

## Required Behavior

- User can configure Telegram bot token through secure onboarding.
- User can configure or discover OpenClaw gateway.
- UI validates gateway health and Telegram outbound message ability.
- UI registers or documents Telegram commands.
- Controller stores only secret references or encrypted secrets according to the chosen secret model.

## Required Tests

- UI flow tests for onboarding.
- API tests for setup validation.
- Fake OpenClaw and Telegram adapter tests.
- Manual or live smoke check for one OpenClaw gateway when credentials are available.

## Gate

Stop for QA after onboarding and OpenClaw/Telegram setup are demonstrably usable.

