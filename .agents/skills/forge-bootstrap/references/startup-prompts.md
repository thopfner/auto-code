# Startup Prompts

## Fresh Codex Planning or QA Session

```text
Use $forge-bootstrap. SSH to <host> and inspect the repo at <remote-repo-path>.
Read AGENTS.md, CLAUDE.md, docs/agent-memory/*.md, and the relevant file in
docs/exec-plans/active/. Compare the docs against live repo state. Then give me:
1. the current objective
2. confirmed constraints and invariants
3. the relevant modules and files
4. the verification commands
5. any stale or missing docs
6. the smallest sensible next task brief
Do not edit anything yet.
```

## Fresh Codex Session To Initialize Repo Memory

```text
Use $forge-memory. Connect to <host> and inspect the repo at <remote-repo-path>.
Create or refresh AGENTS.md, CLAUDE.md, docs/agent-memory/, and docs/exec-plans/
using the repo itself as the source of truth. Keep AGENTS.md short. Write a first-pass
memory pack, copy it to the remote repo if needed, verify the files exist, and then
summarize what still needs human input.
```

## Claude Lead Session On The VPS

```text
Read CLAUDE.md, AGENTS.md, docs/agent-memory/*.md, and the active task brief.
Before making changes, restate the exact scope, owned files, invariants, and
verification plan. If docs and code disagree on a critical point, stop and report it.
Treat the active repo path as the only execution root. If I ask for a new branch or
worktree, interpret that as a GitHub branch request only. Do not create `git worktree`
directories or duplicate repo folders. If the active repo is dirty and no dirty-repo
topology rule is documented, stop and ask before changing branches or repo paths.
```

## Claude Parallel Team Prompt

```text
Create an agent team for this repo. Keep the active repo path as the only code-writing
location.
Spawn 3 teammates:
- backend-data owner
- frontend-ui owner
- tests-and-qa owner
Each teammate must read CLAUDE.md, AGENTS.md, docs/agent-memory/, and the active
brief before acting. Keep file ownership disjoint. Use read-only analysis in parallel,
then serialize code-writing on the active GitHub branch inside the same repo path.
Do not create `git worktree` directories or duplicate repo folders. Require a plan
before editing if the task touches shared interfaces or the database. If the active
target is dirty and repo memory does not already define the topology rule, stop and
ask before changing branches or repo paths. The lead should wait for teammates,
integrate the changes, run full verification, and then report files changed, tests run,
and blockers.
```
