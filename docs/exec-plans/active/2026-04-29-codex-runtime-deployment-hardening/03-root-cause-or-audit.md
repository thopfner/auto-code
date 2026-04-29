# Root Cause Audit

## Finding 1: Active CODEX_HOME Is Read-Only

Severity: critical

The Docker runtime sets:

```yaml
CODEX_HOME: /root/.codex
volumes:
  - ${AUTO_FORGE_CODEX_HOME_DIR:-/root/.codex}:/root/.codex:ro
```

The Codex CLI can read OAuth credentials from the mounted host cache, but `codex exec` still needs writable session/log/cache/config state under the active Codex home or configured directories. The observed VPS artifact reported a read-only filesystem failure during session initialization.

Required correction:

- active `CODEX_HOME` must be writable
- protected auth-source material must be mounted separately when OAuth mode is used
- runtime state must be under the persisted data mount

## Finding 2: Runner Failure Messages Hide The Useful Error

Severity: high

`CodexCliRunner` writes stdout/stderr to JSONL/log artifacts but exposes only `codex exec exited with <code>`. Telegram therefore hides the real operational fix.

Required correction:

- derive a short redacted failure summary from the runner output
- classify common deployment failures such as read-only Codex home, missing auth, missing binary, and permission denied
- keep raw logs in artifacts but avoid secret leakage in Telegram

## Finding 3: Runner Artifacts Are Container-Local By Default

Severity: high

The workflow engine defaults to `.auto-forge/artifacts`, and Compose does not set `AUTO_FORGE_ARTIFACT_ROOT` or `AUTO_FORGE_PROMPT_ROOT`. In production this becomes `/app/.auto-forge/...`, which disappears on rebuild/recreate.

Required correction:

- set artifacts to `/data/artifacts`
- set prompts to `/data/prompts`
- ensure ops log discovery and docs point operators to persisted locations

## Finding 4: Installer Live Smoke Exit Semantics Are Ambiguous

Severity: medium

The installer ignores live smoke failure with `run_live_smoke_gate "$repo_dir" || true`. This can be acceptable for a first-run onboarding path only if the final output and automation state make `BLOCKED_EXTERNAL` explicit. It is not acceptable if the installer is treated as a production go-live gate.

Required correction:

- make the semantics explicit by option or mode
- document which path is non-fatal and which path is a hard deploy gate
- ensure final output cannot be mistaken for fully verified production readiness

## Finding 5: Host/Container Health Path Drift

Severity: medium

Container services use `/data/setup.json`, but host CLI health can read the same env file and interpret `/data/setup.json` as a host path. On the VPS the actual host file is under the Compose data directory.

Required correction:

- distinguish host-visible paths from container runtime paths
- keep `/data/setup.json` for containers
- let host CLI health resolve the Compose data setup file or a dedicated host override

## Finding 6: Test Timeout Claim Needs Hardening, Not Blind Acceptance

Severity: medium

The reported VPS review saw `tests/vps-setup-wizard.test.ts` time out. Local planning on the same HEAD ran that file successfully in 3.96s. This means the failure is environment-sensitive or intermittent.

Required correction:

- make subprocess tests deterministic and comfortably bounded
- avoid relying on Vitest's default 5s timeout for tests whose subprocess timeout is 30s
- keep `npm run verify` truthful on current HEAD and on the VPS

## Finding 7: Durable Orchestration Is Still Incomplete

Severity: high, separate pack

Production docs say the controller should own durable state and queueing, but current runtime uses `MemoryWorkflowStore` in the API and the worker process idles.

Required correction:

- create a separate Postgres workflow/queue durability pack after this deployment repair
- do not mix the schema/queue migration into the current Codex runtime blocker fix
