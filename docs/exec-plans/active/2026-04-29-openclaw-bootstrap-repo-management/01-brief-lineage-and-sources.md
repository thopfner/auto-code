# Brief Lineage And Sources

## Lineage

- v1 created on 2026-04-29 after the VPS installer, Telegram webhook registration, Codex OAuth/API-key selection, and live external smoke became operational on the test VPS.
- The operator then observed that messaging OpenClaw still triggered generic OpenClaw bootstrap/default programming.
- The operator also requested future support for changing VPS repo folders/Git repos from Telegram and generating SSH keys where required.
- v2 QA revision created on 2026-04-29 after Phase 1 implementation correctly added managed OpenClaw workspace bootstrap but still configured OpenClaw's Telegram channel for the same bot by default. OpenClaw's Telegram docs state the gateway owns Telegram runtime behavior and long polling is the default, so that violates the one-inbound-owner invariant.
- v2 QA cleared on 2026-04-29 after the revision removed default same-bot OpenClaw Telegram channel provisioning, preserved managed OpenClaw bootstrap, and passed `npm run verify` plus `npm run full-rebuild`.
- v3 QA cleared on 2026-04-29 after Phase 2 added a safe Telegram repo registry with allowed-root path containment, repo-aware `/scope`, mutating-task switch rejection, and passed targeted repo tests, `npm run verify`, plus `npm run full-rebuild`.

## User Intent

The operator wants Auto Forge to behave like a SaaS deployment product:

- a customer or operator should not manually configure OpenClaw by editing files or answering generic bootstrap prompts
- setup should own the boring system integration work
- Telegram should remain the clean control plane
- repo and GitHub access management should be safe enough for customer-facing use

## Repo-Local Sources

- `scripts/install-vps.sh`
- `apps/api/src/server.ts`
- `packages/core/src/types.ts`
- `packages/core/src/workflow-store.ts`
- `packages/ops/src/openclaw-setup.ts`
- `packages/ops/src/vps-setup.ts`
- `packages/adapters/src/openclaw.ts`
- `tools/live-external-smoke.ts`
- `tests/vps-installer.test.ts`
- `tests/vps-setup-wizard.test.ts`
- `migrations/0001_initial.sql`
- `docs/agent-memory/PROJECT.md`
- `docs/agent-memory/ARCHITECTURE.md`
- `docs/agent-memory/TESTING.md`

## External Primary Sources

- OpenClaw agent bootstrapping: `https://docs.openclaw.ai/start/bootstrapping`
- OpenClaw gateway configuration: `https://docs.openclaw.ai/gateway/configuration`
- OpenClaw config CLI: `https://docs.openclaw.ai/cli/config`
- OpenClaw Telegram/channel docs: `https://docs.openclaw.ai/telegram`
- GitHub deploy key management: `https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys`
- GitHub deploy key REST API: `https://docs.github.com/en/rest/deploy-keys/deploy-keys`
- GitHub SSH key generation: `https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent`

## Key External Facts Applied

- OpenClaw bootstraps its workspace on first agent run and seeds files such as `AGENTS.md`, `BOOTSTRAP.md`, `IDENTITY.md`, and `USER.md`; managed Auto Forge setup must preempt or complete that bootstrap deterministically.
- OpenClaw config lives at `~/.openclaw/openclaw.json` by default and should be changed through `openclaw config set` where possible because the CLI validates writes.
- `openclaw config validate` is the required proof after config changes.
- OpenClaw channel config belongs under `channels.<provider>`, and Telegram channel behavior must not compete with Auto Forge's Telegram webhook ownership.
- OpenClaw Telegram docs state that Telegram is owned by the gateway process and long polling is the default mode; therefore enabling `channels.telegram.enabled` for the Auto Forge bot is not safe while Auto Forge owns the Telegram webhook.
- GitHub deploy keys are per repository; write access is possible but sensitive.
- GitHub deploy-key creation through the API requires appropriate repository administration permission.

## Decisions In This Brief

- Use a separate managed OpenClaw bootstrap script instead of adding more inline shell to `scripts/install-vps.sh`.
- Keep Auto Forge as the sole Telegram inbound owner in Phase 1.
- Treat repo switching and SSH key generation as later phases with explicit QA gates.
- Prefer per-repo SSH deploy keys over one shared global key for future repo automation.
