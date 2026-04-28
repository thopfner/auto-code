# Local Desktop Install

## Prerequisites

- Node.js 24 or newer.
- npm 11 or newer.
- Git.
- Optional Docker Desktop if using Compose locally.

## Bootstrap

```bash
git clone <repo-url> auto-forge-controller
cd auto-forge-controller
scripts/bootstrap.sh
```

Edit `.env` after bootstrap. Do not commit it.
`scripts/bootstrap.sh` runs `npm ci`, which installs the product-managed Codex CLI at `node_modules/.bin/codex`. Leave `CODEX_CLI_COMMAND` empty unless you intentionally want to point Auto Forge at a different executable.

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
npm run full-rebuild
npm run live:smoke
```

Local npm service log discovery checks `.auto-forge/logs/services/<service>/` and reports `not-created` until a service writes files there.
The live smoke command requires staged or live Telegram, OpenClaw, and OpenAI credentials in the shell; it reports `BLOCKED_EXTERNAL` with missing variable names when they are unavailable.
Codex auth is still separate from installation: `OPENAI_API_KEY` is required for unattended live runner smoke.
