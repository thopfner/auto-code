# Root Cause And Audit

## What Works Now

- The one-command VPS installer can deploy the stack.
- Telegram webhook registration is owned by Auto Forge and verified through Telegram `getWebhookInfo`.
- Live external smoke can pass with OpenClaw gateway, Telegram, public reachability, and Codex runner proof.
- Codex OAuth and API-key modes are both supported.
- The public deployment URL is not hardcoded; it is derived from `AUTO_FORGE_PUBLIC_BASE_URL` or the installer prompt.

## Current Gap

OpenClaw is installed/configured enough for gateway health and routed Telegram delivery, but its agent workspace/persona/bootstrap state is not fully productized. When messaged directly, OpenClaw can still behave like a default OpenClaw install and attempt its own bootstrap.

That is wrong for Auto Forge's launch path. The installer should establish the OpenClaw workspace identity, user context, tool boundaries, and startup behavior as part of product setup.

## Root Cause

`scripts/install-vps.sh` currently configures OpenClaw gateway and Telegram settings inline:

- gateway mode and port
- default workspace path
- Telegram token/config
- systemd fallback

It does not own the OpenClaw workspace markdown files as a first-class setup artifact. There is no dedicated script or testable module that says:

- these are the Auto Forge managed OpenClaw files
- this is the intended OpenClaw behavior
- bootstrap is complete or intentionally skipped
- config validation passed before gateway restart

## Risky Seams

- OpenClaw config schema: invalid keys can prevent gateway startup.
- OpenClaw workspace bootstrap: partial or stale files can trigger default behavior.
- Telegram ownership: if OpenClaw owns the same bot inbound path, Auto Forge commands can regress.
- Secrets: Telegram/OpenAI/OpenClaw credentials must stay out of setup JSON and reports.
- Installer reruns: the script must be idempotent and preserve operator values.
- Future repo switching: arbitrary path changes could mutate the wrong repo.
- Future SSH automation: private keys and write deploy keys create a real security boundary.

## Recommended Architecture

Phase 1:

- Add a dedicated OpenClaw bootstrap module/script called by the installer.
- Generate managed markdown files under the configured OpenClaw workspace.
- Use OpenClaw CLI config commands where possible.
- Validate config before gateway restart.
- Keep Auto Forge webhook ownership unchanged.

Later:

- Add a controller-owned repo registry and active repo selection.
- Add Telegram commands that operate on registered repos only.
- Add per-repo SSH key generation and GitHub deploy-key support.

## URL Hardcoding Answer

The deployment URL should remain dynamic. The installer currently derives webhook/public reachability from:

- `AUTO_FORGE_PUBLIC_BASE_URL`
- the interactive `Controller public domain or base URL` prompt

The webhook is built as:

```text
${PUBLIC_BASE_URL%/}/telegram/webhook
```

Therefore the previous `hopfner.dev` deployment is not hardcoded and should work on any server/domain that provides the correct public base URL, DNS, firewall, nginx, and TLS setup.

The only source repo default currently hardcoded is:

```text
https://github.com/thopfner/auto-code.git
```

That value is overrideable through `AUTO_FORGE_REPO_URL` and is not the runtime public URL.

