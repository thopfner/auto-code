# Phase 5 Revision - OpenClaw Bootstrap And Discovery

Execution mode: `FINAL_SHIPGATE_REVISION`
Validation level: `FULL_REBUILD`
Stop gate: `QA_CHECKPOINT`

## Why This Revision Exists

Launch was aborted because the setup wizard asks a noob VPS operator for an `OpenClaw token`. That is not acceptable product UX. The operator normally interacts with OpenClaw through onboarding, gateway status, dashboard, Telegram, and CLI commands; they should not have to know or paste a low-level gateway/webhook token to launch Auto Forge.

## Production-Grade Acceptance Bar

The bar comes from repo conventions plus external OpenClaw primary-source docs.

Ship-ready means:

- The setup wizard no longer asks for an unexplained OpenClaw token in the normal fresh-VPS path.
- OpenClaw setup is expressed as gateway discovery/bootstrap, not token entry.
- Auto Forge uses OpenClaw's documented CLI/gateway concepts where possible.
- Webhooks token auth remains optional advanced configuration only, not the default launch blocker.
- Setup JSON remains references-only.
- Runtime env/docs/tests no longer claim `OPENCLAW_TOKEN` is a required noob launch credential.
- Validation failure messages tell the operator what command or setup step to run next.
- The implementation is covered by targeted tests and `npm run full-rebuild`.

Forbidden shortcuts:

- Do not replace `OpenClaw token` with another unexplained token prompt.
- Do not silently use dummy OpenClaw auth in production paths.
- Do not mark live readiness passed without a real or faithfully simulated OpenClaw gateway proof seam.
- Do not weaken Telegram or Codex validation.

## Required Fix

Rework the setup and validation model around these user-facing modes:

- `detect-existing`: default. Use local OpenClaw CLI/gateway status to discover an existing gateway.
- `install-or-onboard`: run or guide the operator through supported OpenClaw install/onboarding commands, then re-run detection.
- `configure-later`: write setup as incomplete and make health/live smoke report a clear blocked-external reason.
- `advanced-webhook`: optional explicit webhook mode for operators who intentionally provide a hook/token reference.

The exact names may change if code style suggests better phrasing, but the default user experience must not ask for an OpenClaw token.

## Risky Seam Inventory

- External provider contract: OpenClaw CLI and gateway status JSON may vary by version.
- Auth/secrets: gateway tokens and webhook tokens must remain references-only.
- Runtime launch gate: `live:smoke` currently hard-requires `OPENCLAW_TOKEN`; that must change without creating false positives.
- Setup UX: interactive wizard, non-interactive wizard, web onboarding, docs, and env examples must stay aligned.

## Edge-State Matrix

Handle:

- `openclaw` CLI missing.
- OpenClaw CLI installed but gateway not running.
- Gateway running and discoverable locally.
- Gateway running but auth unresolved.
- Operator chooses configure-later.
- Operator chooses advanced webhook mode with explicit token reference.
- Legacy setup JSON containing `openClaw.tokenRef`.

Fail closed when:

- Auto Forge cannot prove OpenClaw gateway reachability and the operator did not choose configure-later.
- A raw OpenClaw token would be persisted to setup JSON.
- A validation path would report live readiness without gateway or webhook proof.

## Implementation Targets

Exact likely files:

- `apps/cli/src/index.ts`
- `tools/live-external-smoke.ts`
- `packages/adapters/src/openclaw.ts`
- `packages/adapters/src/secrets.ts`
- `packages/core/src/setup.ts`
- `packages/ops/src/vps-setup.ts`
- `packages/ops/src/health.ts`
- `.env.example`
- `docs/deployment/README.md`
- `docs/deployment/vps.md`
- `tests/vps-setup-wizard.test.ts`
- `tests/setup-adapters.test.ts`
- `tests/onboarding-flow.test.ts`

Likely web files if the onboarding UI exposes the same OpenClaw token field:

- `apps/web/src/onboarding.ts`
- `apps/web/src/App.tsx`

## Required Behavior

- Interactive setup asks the operator whether to detect/install/configure-later/advanced OpenClaw.
- Non-interactive setup accepts explicit mode flags for deterministic tests.
- The default setup path writes a gateway URL/auth reference selected by detection/bootstrap, not a raw token.
- If OpenClaw CLI is missing, the wizard gives an exact install/onboard next step.
- If OpenClaw gateway is not running, the wizard gives an exact start/onboard next step.
- `live:smoke` required variables no longer include `OPENCLAW_TOKEN` for the default gateway mode.
- Advanced webhook mode may still require a token reference, but its docs must state it is advanced and optional.
- Existing setup JSON with `tokenRef` should be tolerated or migrated in a backward-compatible way.

## Proof Map

- Setup UX seam: targeted CLI tests must prove no normal-mode prompt/help/docs require `OpenClaw token`.
- OpenClaw CLI seam: tests must simulate `openclaw gateway status --json --require-rpc` success, missing CLI, and gateway-not-running outputs.
- Secrets seam: tests must prove setup JSON contains references only and no raw OpenClaw auth.
- Live gate seam: tests must prove missing `OPENCLAW_TOKEN` alone does not produce `BLOCKED_EXTERNAL` in default gateway mode.
- Legacy seam: tests must prove old `tokenRef` setup still validates or produces a clear migration-safe path.

## Required Validation

Run and report:

```bash
npm run verify
npm run full-rebuild
```

Also run a direct deterministic setup proof command that creates a temporary setup/env path with the default OpenClaw mode and demonstrates:

- no OpenClaw token prompt or flag is required
- setup JSON remains references-only
- missing `OPENCLAW_TOKEN` is not by itself a launch blocker

If live Telegram/OpenClaw/OpenAI credentials are available, run:

```bash
npm run live:smoke
```

If they are unavailable, stop as `BLOCKED_EXTERNAL` only after the deterministic OpenClaw bootstrap/discovery proof succeeds.

## Completion Report

Write a timestamped report under `reports/`, refresh `reports/LATEST.md`, refresh `reports/LATEST.json`, update `automation/state.json` and `automation/qa.json`, commit, push, and report:

- exact OpenClaw setup modes implemented
- files changed
- proof that the normal wizard path no longer asks for OpenClaw token
- proof setup JSON remains references-only
- proof missing `OPENCLAW_TOKEN` alone is no longer the default blocker
- tests run
- implementation commit SHA
- stop report commit SHA

## QA Gate

QA cannot accept fresh-VPS launch until a noob operator can proceed through setup without knowing or supplying an OpenClaw token.
