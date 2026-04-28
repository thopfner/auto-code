# Worker Handoff Prompt Shape

Use this compact shape for paste-ready coding-agent launch prompts from `forge-plan` and `forge-qa-brief`.

Keep the handoff short enough to paste as one prompt. Do not duplicate the full brief. Point the worker to the exact files that contain detail.

## Shape

```text
You are implementing one authorized window in the active repo.

Target:
- Repo: <absolute repo path>
- Branch: <branch>
- Brief: <docs/exec-plans/active/<brief-id>>
- Authorization: <phase file or contiguous AUTONOMOUS block only>

Read for context:
- Read mode: <FULL_REHYDRATE | BRIEF_REHYDRATE | HOT_RESUME>
- Read these files, in order:
  - <exact files>
- Do not mention or invoke forge-bootstrap for this worker handoff.

Execute now:
- Implement only: <current phase/window>
- Goal: <one-sentence outcome>
- Owned paths: <exact paths/globs or authorized modules>
- Reuse: <existing files/workflows to follow>
- Do not change: <non-goals/invariants>
- Later phases are context only until a new handoff authorizes them.

Quality bar:
- Satisfy the brief's Production-grade acceptance bar.
- Do not leave known cleanup, duplicated logic, brittle seams, TODO-driven behavior, untested behavior, or immediate refactor debt unless the brief explicitly authorizes it.

Validation:
- Validation level: <NO_RUNTIME_CHECK | LIVE_RELOAD | SERVICE_RESTART | FULL_REBUILD>
- Allowed runtime commands: <exact commands or "none">
- Required proof: <tests/build/runtime or functional proof>
- If validation cannot be made truthful inside this level, stop and report the blocker.

Stop report:
- Write a timestamped report under the active brief's reports/ folder.
- Refresh reports/LATEST.md.
- Refresh reports/LATEST.json only when present and only enough to keep it aligned with the newest stop report.
- Update automation/state.json only when present and only enough so it no longer claims stale READY_FOR_IMPLEMENTATION.
- Include a Durable memory candidates section with any facts that should be promoted to repo memory at final shipgate.
- Do not update durable repo memory at an intermediate checkpoint unless this phase explicitly requires it for later phases or fresh sessions.
- Commit and push at QA_CHECKPOINT, FINAL_SHIPGATE, or blocker stop unless the brief says otherwise.
- Report branch, files changed, tests run, implementation_commit_sha, stop_report_commit_sha, and push status.
```

## Rules

- Use headings exactly: `Target`, `Read for context`, `Execute now`, `Quality bar`, `Validation`, `Stop report`.
- Prefer exact paths over prose.
- Keep `Read for context` lean. Use `FULL_REHYDRATE` for a first handoff or stale-context risk, `BRIEF_REHYDRATE` for same-brief continuation, and `HOT_RESUME` only inside the same live coding session.
- Keep `Execute now` bounded. A worker prompt may not authorize phases beyond the next external review gate.
- Include enough validation detail for the worker to prove the change, not just claim completion.
- If there are multiple workers, emit one prompt per worker with disjoint owned paths.
