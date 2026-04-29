# Phase 3 - GitHub SSH Key Manager

Execution mode: `QA_CHECKPOINT`
Validation level: `FULL_REBUILD`
Authorization status: context only, not authorized yet

## Goal

Generate, store, display, validate, and optionally register repo-scoped SSH deploy keys so Auto Forge can clone and push to newly registered GitHub repos without manual VPS shell work.

## Why This Is A Later Phase

SSH keys and deploy keys are security-sensitive. A mistake can leak private keys or grant unintended write access. This phase needs its own design and QA gate.

## Expected Commands

Design and implement commands close to:

```text
/repo key create <alias>
/repo key show <alias>
/repo key test <alias>
/repo key github-add <alias>
/repo git-test <alias>
```

Exact naming may change to fit the final repo command grammar.

## Required Safety Model

- Generate Ed25519 keys per repo.
- Store private keys under a controlled path such as `/etc/auto-forge-controller/ssh/<repo-id>/id_ed25519`.
- Set private key mode `0600`.
- Set containing directories to restrictive permissions.
- Never send private keys through Telegram.
- Telegram may show only the public key and fingerprint.
- Support manual GitHub deploy-key setup with clear instructions.
- Optional API-based deploy-key creation requires a configured `GITHUB_TOKEN` or GitHub app credential with the correct repository administration permission.
- Write deploy keys must be an explicit operator choice, not the default silent behavior.
- Validate Git access with `git ls-remote`.
- Validate push ability with a safe `git push --dry-run` or equivalent non-mutating proof when feasible.

## Expected Code Surfaces

Likely:

- new SSH key manager module under `packages/ops/src/` or `packages/core/src/`
- Telegram repo command handling in `apps/api/src/server.ts`
- runtime config for allowed SSH key root and optional GitHub token reference
- tests for key generation, permission checks, redaction, and git command construction
- docs for GitHub deploy-key flows

## GitHub Constraints To Preserve

- Deploy keys are scoped to one repository.
- Deploy keys are read-only by default.
- Write access must be intentional.
- Creating deploy keys through the GitHub API requires sufficiently privileged repo administration access.

## Required Proof

- Private key file mode proof.
- Public key/fingerprint output proof.
- Redaction tests proving private key material does not appear in Telegram/API/report output.
- Git command tests with fake command runners.
- Optional live GitHub proof only when a disposable repo and suitable token are available.
- `npm run verify`
- `npm run full-rebuild`

## Stop Gate

Stop at `QA_CHECKPOINT`. Do not start final integration until QA clears SSH key management.

