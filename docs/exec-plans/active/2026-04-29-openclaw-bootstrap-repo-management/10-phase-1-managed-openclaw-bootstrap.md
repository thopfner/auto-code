# Phase 1 - Managed OpenClaw Bootstrap

Execution mode: `QA_CHECKPOINT`
Validation level: `FULL_REBUILD`
Read mode: `FULL_REHYDRATE`

## Goal

Add a separate managed OpenClaw bootstrap script, called by the VPS installer, that creates the core OpenClaw workspace markdown files and initial OpenClaw settings before the operator messages OpenClaw.

## Non-Goals

- Do not implement Telegram repo switching yet.
- Do not implement SSH key generation yet.
- Do not change the controller's Telegram webhook ownership.
- Do not make OpenClaw long-poll or set a webhook on the same Telegram bot.
- Do not add a new manual setup requirement.
- Do not persist raw secrets in setup JSON.

## Owned Paths

Exact expected owned paths:

- `scripts/install-vps.sh`
- new `scripts/setup-openclaw.sh`
- new TypeScript module or CLI tool under `tools/` or `packages/ops/src/`
- new OpenClaw workspace templates under a repo-local directory such as `assets/openclaw-workspace/`
- `package.json` if a new npm script is useful
- `tests/vps-installer.test.ts`
- new targeted tests such as `tests/openclaw-bootstrap.test.ts`
- deployment docs only where directly needed for the changed installer behavior
- this brief's `reports/**`
- this brief's `automation/**`

If implementation discovers a better existing module boundary, use it, but keep ownership scoped and report the final file list.

## Required Behavior

- The installer calls the managed OpenClaw bootstrap script during `OPENCLAW_SETUP_MODE=install-or-onboard`.
- The script is idempotent and safe to rerun.
- The script creates the OpenClaw workspace directory with restrictive enough permissions for local agent context.
- The script writes managed core files, at minimum:
  - `AGENTS.md`
  - `SOUL.md`
  - `USER.md`
  - `IDENTITY.md`
  - `TOOLS.md`
  - `HEARTBEAT.md`
- The managed files define Auto Forge's role clearly:
  - OpenClaw is the local gateway/helper for Auto Forge Controller.
  - Auto Forge Controller owns task state, queueing, repo locks, QA stops, and Telegram slash commands.
  - The agent should not ask the operator to redo generic bootstrap.
  - The agent should not mutate `/opt/forge-skills`.
  - The agent should not bypass Auto Forge approvals or repo locks.
- The script removes, suppresses, or marks complete any `BOOTSTRAP.md` path that would trigger generic first-run bootstrap, using documented OpenClaw behavior where possible.
- The script configures `agents.defaults.workspace` through `openclaw config set` when the CLI is available.
- The script sets or preserves gateway config already required by the installer.
- The script runs `openclaw config validate` when OpenClaw CLI is available and fails closed if validation fails.
- The script does not print raw Telegram/OpenAI/OpenClaw secrets.
- The script does not write any secret values into setup JSON.

## Telegram Ownership Constraint

Do not configure OpenClaw to own inbound Telegram for the same bot in Phase 1. The working invariant is:

```text
Telegram Bot API -> Auto Forge webhook -> controller workflow
```

OpenClaw may remain available for gateway health and outbound helper checks, but Auto Forge must keep the webhook at `${PUBLIC_BASE_URL}/telegram/webhook`.

If the existing installer code configures OpenClaw Telegram channel settings, review whether those settings cause inbound competition. If they do, change them so Phase 1 preserves Auto Forge's webhook ownership while still allowing required health/smoke behavior. Add regression tests for this.

## Edge-State Matrix

Handle:

- OpenClaw CLI missing during dry-run.
- OpenClaw CLI missing during real install before installer installs it.
- Existing OpenClaw config present and valid.
- Existing OpenClaw config present but missing workspace defaults.
- Existing managed workspace files present from a prior run.
- Existing unmanaged workspace files present.
- Existing `BOOTSTRAP.md` present.
- `OPENCLAW_SETUP_MODE=detect-existing`.
- `OPENCLAW_SETUP_MODE=configure-later`.
- `AUTO_FORGE_PUBLIC_BASE_URL` set to any valid HTTPS domain.

Fail closed when:

- OpenClaw config validation fails after managed changes.
- The script would overwrite non-managed user content without backup or clear managed markers.
- The installer cannot preserve Telegram webhook ownership.

## Implementation Guidance

- Prefer a small TypeScript tool for deterministic file generation and test coverage, wrapped by `scripts/setup-openclaw.sh` for installer ergonomics.
- Put template content in repo files rather than large shell heredocs.
- Add clear managed markers to generated markdown files so reruns can safely update Auto Forge-owned content.
- If unmanaged existing files are found, either preserve them and append a managed section, or back them up before replacement. Report the chosen behavior.
- Use `openclaw config set` for small config changes where possible because OpenClaw validates writes.
- Run `openclaw config validate` after changes.

## Proof Map

- Workspace bootstrap seam:
  - targeted test proves all required `.md` files are created with managed content
  - targeted test proves rerun is idempotent
  - targeted test proves `BOOTSTRAP.md` does not remain as a generic bootstrap trigger
- OpenClaw config seam:
  - test proves installer/source calls the bootstrap script
  - test proves config validate is invoked or skipped only in dry-run/missing-CLI paths with explicit output
- Telegram ownership seam:
  - test proves webhook registration still uses `${PUBLIC_BASE_URL%/}/telegram/webhook`
  - test proves no Phase 1 code hardcodes `hopfner.dev`
- Secret seam:
  - test or inspection proof confirms generated workspace/setup files do not contain raw Telegram/OpenAI secrets
- Installer rerun seam:
  - test proves existing runtime env/defaults remain reusable

## Required Validation

Run and report:

```bash
bash -n scripts/install-vps.sh
bash -n scripts/setup-openclaw.sh
npm run test -- --run tests/vps-installer.test.ts tests/openclaw-bootstrap.test.ts
npm run verify
npm run full-rebuild
```

If the exact test filename differs, report the actual targeted test command.

Also run a deterministic local proof command that writes the managed OpenClaw workspace into a temporary directory and shows:

- required markdown files exist
- managed content is present
- `BOOTSTRAP.md` is absent or explicitly neutralized
- no raw secrets are printed

If live VPS credentials are available, also run:

```bash
npm run live:smoke
```

If live credentials are unavailable in the coding environment, do not block Phase 1 solely on that. The test VPS can perform live proof after QA.

## Stop Report Requirements

The report must include:

- files changed
- exact OpenClaw files generated
- how existing unmanaged files are handled
- proof that the installer calls the bootstrap script
- proof the public URL is dynamic
- proof Telegram webhook ownership remains Auto Forge-owned
- tests run
- any live proof or why it was not available
- durable memory candidates
- `implementation_commit_sha`
- `stop_report_commit_sha`

## Gate

Stop at `QA_CHECKPOINT`. Do not start Phase 2 until QA clears Phase 1.

