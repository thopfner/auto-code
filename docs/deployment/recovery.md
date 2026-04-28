# Recovery Runbook

## Stuck Task Inspection

Run:

```bash
npm run ops:health
npm run ops:recover -- --action list-stuck --dry-run
```

Then inspect:

- `docs/exec-plans/active/2026-04-28-auto-forge-controller/automation/state.json`
- `docs/exec-plans/active/2026-04-28-auto-forge-controller/automation/qa.json`
- `.auto-forge/logs/tasks/<task-id>/`
- `reports/LATEST.md` and `reports/LATEST.json` inside the active brief

## Mark Blocked

When a task cannot safely continue because credentials, network access, or a repo lock is missing:

```bash
npm run ops:recover -- --action mark-blocked --task <task-id>
curl -fsS -X POST http://127.0.0.1:3000/workflow/tasks/<task-id>/recover \
  -H 'content-type: application/json' \
  -d '{"action":"mark-blocked","reason":"Operator recovery"}'
```

The CLI writes `.auto-forge/logs/tasks/<task-id>/recovery.jsonl`. The API call mutates the running controller workflow store and appends an `operator_recovery_blocked` event.

## Cancel

When a task should not continue:

```bash
npm run ops:recover -- --action cancel --task <task-id>
curl -fsS -X POST http://127.0.0.1:3000/workflow/tasks/<task-id>/recover \
  -H 'content-type: application/json' \
  -d '{"action":"cancel","reason":"Cancelled by operator recovery"}'
```

Record the reason in the task report and leave Forge artifacts intact for audit.

## Backup And Restore

Create a references-only backup:

```bash
npm run ops:backup -- --output backups/pre-recovery.json
```

Dry-run restore before importing:

```bash
npm run ops:restore -- --input backups/pre-recovery.json --dry-run
```

Restores intentionally write only the onboarding setup record. Raw secrets must be reattached through the runtime environment named by the secret references.
