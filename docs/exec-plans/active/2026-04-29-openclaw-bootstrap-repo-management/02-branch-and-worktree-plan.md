# Branch And Worktree Plan

## Branch

- Use the current GitHub branch: `main`.
- Commit and push every QA checkpoint and final shipgate stop.

## Worktree

- `worktree`: `null`
- Do not create `git worktree` directories.
- Do not create sibling clones or duplicate repo checkouts for this task.

## File Ownership

The Phase 1 worker owns only the files named in `10-phase-1-managed-openclaw-bootstrap.md`.

Later phases will expand ownership only when separately authorized:

- Phase 2 will own Telegram repo registry commands and repo active-selection state.
- Phase 3 will own SSH key generation, Git remote validation, and optional GitHub deploy-key API integration.
- Phase 4 will own final integration proof and memory/archive updates.

## Coordination Rule

If the repo is dirty before implementation starts, inspect the diff. If the dirty files overlap Phase 1 owned paths and are not clearly created by this task, stop and ask before editing.

