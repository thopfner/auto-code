# Branch And Repo-Path Plan

## Lead GitHub Branch

- `main` until the user creates a GitHub remote/branch policy.

## Worker Ownership

Initial phase ownership is single-lead only. Later phases may split after API/schema contracts stabilize.

## Integration Order

1. Foundation and schema.
2. Onboarding and OpenClaw/Telegram integration.
3. Codex/Forge engine.
4. Deployment and operations.
5. E2E hardening.

## File-Collision Stop Rules

Stop if another worker edits the same files or if unrelated dirty state appears.

## Branch Hygiene Rules

- No `git worktree`.
- No sibling clone.
- No duplicate repo checkout.
- Commit and push at every QA checkpoint unless blocked.
- Use full 40-character SHAs in reports and automation JSON.
- Keep `automation/state.json`.`worktree` as `null`.

