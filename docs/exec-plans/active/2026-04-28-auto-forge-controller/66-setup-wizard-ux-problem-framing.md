# Setup Wizard UX Problem Framing

Updated: `2026-04-29T06:57:08Z`

## Objective

Remove remaining high-friction terminal interactions from the fresh-VPS setup wizard so it is suitable for a future browser/chat-driven onboarding flow.

## Triggering Field Findings

Fresh launch testing exposed two unacceptable setup behaviors:

1. Telegram chat discovery exits when `getUpdates` returns no chats, forcing the operator to rerun the full setup after messaging the bot.
2. Codex OAuth runs the normal browser-login flow and asks the user to type `I UNDERSTAND`, then the Codex CLI itself recommends `codex login --device-auth` for remote/headless machines.

Both behaviors violate the product target: a SaaS owner should be able to guide customers through setup smoothly, and the future chat setup workflow should not rely on hostile terminal confirmations or full wizard restarts.

## Desired Outcome

- Telegram chat discovery can retry in place after the operator sends a message to the bot.
- The user can switch from discovery to manual chat ID entry without restarting setup.
- Codex OAuth mode uses a headless/server-safe device-auth flow.
- The setup wizard no longer requires typing `I UNDERSTAND`.
- Setup logic is structured so the future browser/chat wizard can reuse the same behavior instead of duplicating terminal-only code.

## Non-Goals

- Do not build the future browser/chat onboarding UI in this revision.
- Do not change the default Codex auth mode away from API key.
- Do not weaken references-only setup JSON or env-file secret handling.
- Do not change OpenClaw fail-closed behavior.
- Do not change final live-smoke credential requirements.

## Current Code Reality

- `apps/cli/src/index.ts` implements the interactive wizard.
- `promptTelegramChatId()` throws on empty Telegram updates with: `Telegram getUpdates returned no chats. Send a message to the bot, then rerun setup.`
- `promptCodexAuth()` requires typing `I UNDERSTAND` for OAuth and runs `codex login`.
- `node_modules/.bin/codex login --help` in the pinned `@openai/codex@0.125.0` CLI exposes `--device-auth`.
- `packages/ops/src/vps-setup.ts` contains the reusable Telegram `getUpdates` discovery helper.

## Source Notes

- OpenAI Help Center says Codex CLI can authenticate through ChatGPT sign-in and stores credentials locally: `https://help.openai.com/en/articles/11381614`
- OpenAI Help Center also documents API-key auth as the unattended/CI-oriented path: `https://help.openai.com/en/articles/11096431-openai-codex-ci-getting-started`
- Local pinned CLI proof: `node_modules/.bin/codex login --help` lists `--device-auth` and `--with-api-key`.

## Production-Grade Bar Source

The bar comes from repo conventions, field launch feedback, and current Codex CLI help for the pinned managed dependency.

Ship-ready means the setup wizard handles expected operator timing and remote-auth realities without asking the user to restart setup, type magic confirmation phrases, or interpret raw CLI fallback advice.
