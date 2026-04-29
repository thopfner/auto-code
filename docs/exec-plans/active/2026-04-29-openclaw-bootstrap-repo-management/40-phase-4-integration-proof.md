# Phase 4 - Integration Proof

Execution mode: `FINAL_SHIPGATE`
Validation level: `FULL_REBUILD`
Authorization status: context only, not authorized yet

## Goal

Prove the end-to-end SaaS-owner flow after Phase 1 through Phase 3 are complete.

## Required Proof

On a clean or effectively wiped test VPS:

1. Clone the repo.
2. Run the one-command installer.
3. Confirm installer creates managed OpenClaw workspace files.
4. Confirm OpenClaw does not ask for generic bootstrap/default setup.
5. Confirm Auto Forge owns the Telegram webhook.
6. Confirm `/status` works.
7. Confirm `/repos` and `/repo use` work.
8. Register or clone a disposable GitHub repo.
9. Generate a repo-scoped SSH key.
10. Add the public deploy key manually or through approved API automation.
11. Prove Git read and intended write/dry-run access.
12. Run `/scope @repo-alias <demo task>`.
13. Confirm queue/task state routes to the selected repo.
14. Run `npm run live:smoke`.

## Required Local Validation

```bash
npm run verify
npm run full-rebuild
```

## Final Memory And Archive

At final shipgate:

- update durable memory only for facts that actually changed
- update `docs/agent-memory/CURRENT_STATE.md`
- update `docs/agent-memory/ARCHITECTURE.md` if repo registry or SSH key manager architecture landed
- update `docs/agent-memory/DECISIONS.md` for durable decisions about Telegram ownership, OpenClaw bootstrap, and deploy-key model
- update `docs/agent-memory/TESTING.md` if validation commands changed
- archive the accepted brief to `docs/exec-plans/completed/`

## Gate

Final clearance requires QA approval. Do not self-clear.

