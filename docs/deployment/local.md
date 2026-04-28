# Local Desktop Install

## Prerequisites

- Node.js 24 or newer.
- npm 11 or newer.
- Git.
- Codex CLI available as `codex` for live runner smoke.
- Optional Docker Desktop if using Compose locally.

## Bootstrap

```bash
git clone <repo-url> auto-forge-controller
cd auto-forge-controller
scripts/bootstrap.sh
```

Edit `.env` after bootstrap. Do not commit it.

## Start Services

Use three terminals:

```bash
npm run start:api
npm run start:worker
npm run start:web -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`, complete onboarding, and keep tokens in environment variables referenced by `.env`.

## Local Operations

```bash
npm run ops:health
npm run ops:backup -- --output backups/local-backup.json
npm run ops:restore -- --input backups/local-backup.json --dry-run
npm run ops:recover -- --action list-stuck --dry-run
npm run auto-forge -- logs --task <task-id>
npm run auto-forge -- logs --service api
```

Local npm service log discovery checks `.auto-forge/logs/services/<service>/` and reports `not-created` until a service writes files there.
