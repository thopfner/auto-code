# OpenClaw Bootstrap Problem Framing

## Objective

Rework the fresh-VPS setup flow so a first-time operator is not asked to supply an unexplained OpenClaw token.

## Desired Outcome

The setup wizard should guide the operator through OpenClaw in product terms:

- detect an existing OpenClaw gateway when available
- offer to install or run OpenClaw onboarding when it is missing
- let OpenClaw generate and own its gateway auth
- persist only references and derived setup details in Auto Forge config
- keep final launch validation truthful without requiring a user-entered `OPENCLAW_TOKEN`

## In Scope

- Setup wizard prompts and non-interactive options.
- OpenClaw adapter and health/smoke validation assumptions.
- Runtime env names and docs for OpenClaw gateway connectivity.
- Tests proving setup no longer prompts for or requires a raw OpenClaw token.
- Launch docs for a noob VPS operator.

## Out Of Scope

- Replacing OpenClaw as the Telegram-facing gateway.
- Removing Telegram Bot API validation.
- Removing OpenAI/Codex credential requirements.
- Mutating `/opt/forge-skills`.
- Creating duplicate repo checkouts or `git worktree` directories.

## Constraints And Invariants

- Auto Forge Controller still uses OpenClaw as the human-facing Telegram gateway.
- Setup JSON must remain references-only.
- Raw Telegram/OpenAI secrets may only be written to ignored env files or service-managed secret stores.
- OpenClaw auth should follow OpenClaw's own gateway/onboarding model rather than inventing a new user-facing secret.
- Live go-live proof still requires a real Telegram/OpenClaw/OpenAI path.

## Relevant Code Surfaces

- `apps/cli/src/index.ts`
- `tools/live-external-smoke.ts`
- `packages/adapters/src/openclaw.ts`
- `packages/adapters/src/secrets.ts`
- `packages/core/src/setup.ts`
- `packages/ops/src/vps-setup.ts`
- `packages/ops/src/health.ts`
- `apps/web/src/onboarding.ts`
- `apps/web/src/App.tsx`
- `.env.example`
- `docs/deployment/README.md`
- `docs/deployment/vps.md`
- `tests/vps-setup-wizard.test.ts`
- `tests/setup-adapters.test.ts`
- `tests/onboarding-flow.test.ts`

## Unknowns And Risks

- Exact OpenClaw CLI JSON shapes may vary by installed OpenClaw version.
- OpenClaw may expose gateway health through WebSocket RPC, HTTP health, or both depending on install mode.
- Webhooks plugin token auth is a separate advanced path and must not be confused with normal gateway onboarding.
- A fully automated OpenClaw install may need to stop with clear operator instructions when `openclaw` is not installed or onboarding cannot run non-interactively.
