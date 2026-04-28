# Reports

Every QA checkpoint, final shipgate, or blocker stop writes one timestamped report here and refreshes `LATEST.md`.

Report filenames should use:

```text
YYYY-MM-DDTHH-MM-SSZ-phase-<n>-<status>.md
```

Each report must include:

- phase addressed
- stop status
- summary
- branch and repo path confirmation
- implementation commit SHA
- stop/report commit SHA when available
- push status
- files changed
- tests run
- functional QA performed
- blockers or residual risks
- durable memory candidates

