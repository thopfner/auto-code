# UI Goals And User Journeys

## User

The primary user is the operator who scopes tasks in Telegram and manages automation across one or more repos/VPS installs.

## Primary Journeys

1. Fresh install onboarding.
2. Telegram/OpenClaw connection setup.
3. Codex auth and runner profile setup.
4. Repo registration and user authorization.
5. Queue monitoring and task detail review.
6. Approval and blocker resolution.
7. Portability export/import and health checks.

## Primary Action

After onboarding, the primary action is monitoring and unblocking Forge automation, not creating decorative content.

## Failure Points To Design For

- Telegram bot token invalid.
- OpenClaw gateway unreachable.
- Codex auth missing or expired.
- Repo SSH access unavailable.
- Task stuck in runner.
- Forge artifact missing or inconsistent.
- Push failed.

