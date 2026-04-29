# One-Command VPS Installer Options And Recommendation

## Option 1 - Thin Wrapper Around Existing Commands

Add `scripts/install-vps.sh` that runs clone/bootstrap/setup/compose/nginx commands in sequence.

Pros:

- Fastest implementation.
- Reuses current commands.

Cons:

- Still depends on host Node/npm unless the script installs them.
- Does not fix Compose env/setup-path mismatch.
- Still exposes too much implementation detail to the operator.
- Likely to fail mid-flow without resumable state or clear recovery.

Verdict: too weak for the product bar.

## Option 2 - Recommended: Installer Orchestrator Plus Compose Runtime Alignment

Add a real VPS installer that owns prerequisites, repo checkout, runtime env, setup, Compose deployment, nginx/TLS, and proof gates. Update Compose/runtime wiring so the env/setup artifacts written by the installer are the same artifacts the services consume.

Core shape:

- `scripts/install-vps.sh`
  - can run from a cloned repo or via `curl | sudo bash`
  - clones/updates `/opt/auto-forge-controller`
  - installs missing system prerequisites on Ubuntu
  - installs Docker Engine/Compose plugin from Docker's official apt repo when missing
  - installs nginx when selected
  - installs Certbot when HTTPS is selected and DNS is ready
  - builds the repo Docker image
  - runs the setup wizard inside the deployment context
  - writes `/etc/auto-forge-controller/auto-forge.env` with mode `0600`
  - writes setup JSON to the Compose data volume path used by services
  - starts `postgres`, `api`, `worker`, and `web`
  - installs/reloads nginx
  - optionally runs Certbot
  - runs health/smoke checks
  - prints a final verdict
- `docker-compose.yml`
  - stops hardcoding values that must come from installer/runtime env
  - supports a root-owned runtime env file path through an installer-controlled variable
  - keeps safe defaults for local dev/full-rebuild
- tests/docs
  - deterministic dry-run coverage for installer behavior
  - shell syntax proof
  - setup JSON references-only proof
  - env mode proof
  - Compose config/runtime env proof

Pros:

- Matches the actual SaaS-owner launch experience.
- Fixes deployment wiring instead of hiding it.
- Keeps current product architecture.
- Can be tested without mutating the host by using dry-run/planning mode.

Cons:

- Larger than a wrapper.
- Touches shell, Compose, CLI setup, docs, and tests.
- Must be strict about idempotency and secrets.

Verdict: recommended.

## Option 3 - Browser/Chat Installer Now

Build the future frontend/chat setup experience immediately.

Pros:

- Aligns with long-term target.
- Better customer experience eventually.

Cons:

- Too broad for the current launch blocker.
- Would mix frontend setup state, API mutations, deployment orchestration, secrets, Docker/nginx/TLS, and provider flows in one risky slice.
- Still needs a server-side/bootstrap installer before the browser exists.

Verdict: defer until the one-command server installer is stable.

## Recommendation

Proceed with Option 2.

This is the smallest production-grade path that makes a fresh VPS launch feel like a product while preserving the existing controller architecture and deterministic test surface.

The implementation must not merely print fewer instructions. It must actually automate the host/deploy work that a non-technical SaaS owner should not perform manually.

