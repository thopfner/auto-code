# Final QA And Merge Gate

Gate: `FINAL_SHIPGATE`  
Validation level: `FULL_REBUILD`  
Authorization: context only until all implementation checkpoints clear

## Goal

Independently verify the complete publish retry and durable workflow behavior, then prepare final closeout.

## Required Checks

- `npm run verify` passes from source checkout.
- Target checkout has pulled the accepted source commit.
- API and worker services start with `DATABASE_URL`.
- `ops:health` reports durable store readiness truthfully.
- Repo registration and active selection survive API restart.
- A task blocked by push failure remains visible after restart.
- `/task status <task-id>` gives actionable state.
- `/task retry <task-id>` performs publish-only retry and completes the task when push succeeds.
- `/task logs <task-id>` reports artifact/log locations without secrets.
- Failed publish retry preserves exact remediation.

## Final QA Responsibilities

- Do not self-clear earlier implementation work without independent evidence.
- Commit and push final stop artifacts.
- Verify `git status --short` is clean except for explicitly unrelated pre-existing files.
- Prepare memory candidates for `99-memory-pack-update.md`.

