# OpenClaw Bootstrap Options And Recommendation

## Sources Checked

Repo-local:

- Current setup wizard in `apps/cli/src/index.ts`.
- Current OpenClaw adapter in `packages/adapters/src/openclaw.ts`.
- Current live smoke in `tools/live-external-smoke.ts`.
- Current launch docs in `docs/deployment/vps.md`.

External primary sources:

- OpenClaw Gateway CLI docs: https://docs.openclaw.ai/cli/gateway
- OpenClaw Getting Started docs: https://openclaw.im/docs/start/getting-started
- OpenClaw Webhooks plugin docs: https://docs.openclaw.ai/plugins/webhooks
- OpenClaw webhook auth docs: https://openclawlab.com/en/docs/automation/webhook/

## Option A: Keep Webhook Token Model And Improve Copy

Keep prompting for OpenClaw token, but explain where to find it.

Tradeoff: lowest implementation cost, but still wrong for the target user. It assumes the operator understands OpenClaw internal auth and has already configured an advanced webhook route.

Decision: rejected.

## Option B: Discover Existing Gateway Only

Remove the raw token prompt and use `openclaw gateway status --json --require-rpc` plus local defaults to detect an existing gateway. If missing, stop with instructions to run OpenClaw onboarding separately.

Tradeoff: much better UX for users who already have OpenClaw configured, but it still leaves a first-time VPS user with a second manual product setup path.

Decision: acceptable fallback, not enough for launch.

## Option C: Recommended - Setup Owns OpenClaw Bootstrap And Discovery

Make Auto Forge setup offer an OpenClaw step:

1. Detect existing OpenClaw gateway.
2. If absent, offer to install/configure OpenClaw by invoking supported OpenClaw CLI onboarding/install commands.
3. Let OpenClaw generate/store gateway auth.
4. Persist Auto Forge references to the gateway URL/auth source rather than asking the user for an OpenClaw token.
5. Treat Webhooks plugin token as optional advanced mode only.

Tradeoff: higher implementation cost, but it matches OpenClaw's current model and the target noob VPS launch experience.

Decision: recommended.

## Recommended Approach

Implement Option C with a conservative fallback:

- Replace the user-facing `OpenClaw token` prompt with `OpenClaw setup mode`.
- Prefer local gateway discovery through the OpenClaw CLI.
- Support non-interactive explicit gateway references for CI and advanced operators.
- Keep webhooks token support only as an advanced optional reference, not the default or required launch path.
- Update `live:smoke` so it no longer fails just because `OPENCLAW_TOKEN` is missing; it should validate OpenClaw through the selected gateway mode and fail with actionable OpenClaw setup instructions when discovery/auth fails.

## Why This Is The Best Fit For The Repo Now

The project mission is a deployable product for a fresh VPS operator, not a framework requiring prior integration knowledge. Current code incorrectly exposes an internal integration secret as a first-run requirement. OpenClaw documentation shows the gateway and its own onboarding/token generation are the source of truth, so Auto Forge should automate around that instead of inventing a token prompt.

## What Would Justify A Different Choice Later

If OpenClaw publishes a stable HTTP webhook provisioning API specifically for third-party apps, Auto Forge could add a fully automated remote-registration path. Until then, CLI-driven gateway discovery/bootstrap is safer and more aligned with the documented product.
