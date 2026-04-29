# Phase 3 QA Checkpoint - Target Deployment Proof Blocked

- stop_status: `BLOCKED_EXTERNAL`
- reviewed_phase: `30-phase-3-vps-telegram-proof.md`
- branch: `main`
- source_candidate_commit_sha: `d3204e5e908224f56a1570a05e5c4f968c902e91`
- prior_phase_stop_report_commit_sha: `5c4063d9b3f2429259dfeab1ea30db6ccf894580`
- target_install_path: `/opt/auto-forge-controller`
- updated_at: `2026-04-29T21:45:56Z`
- next_authorized_phase: `30-phase-3-vps-telegram-proof.md`

## Findings

Phase 3 target-deployment proof is blocked before rebuild, service restart, Telegram smoke, or Codex runner proof.

- `origin/main` is reachable and currently resolves to `d3204e5e908224f56a1570a05e5c4f968c902e91`.
- The expected deployed target checkout `/opt/auto-forge-controller` is absent on this host.
- No alternate operator-approved target install path was discoverable under `/opt`, `/srv`, `/home`, or nearby `/var/www` repo paths.
- Because the active brief forbids treating `/var/www/html/auto.thapi.cc` as the deployed runtime, no target `npm run verify`, Docker Compose rebuild/up/log inspection, Telegram `/scope`, or Codex proof was run from the source/dev checkout.

Finding classification: `validation_only`.

## Evidence Collected

Source/dev checkout:

```bash
pwd
git status --short --branch
git branch --show-current
git rev-parse HEAD
git log --oneline --decorate -8
git ls-remote origin refs/heads/main
```

Observed:

- Current source/dev path: `/var/www/html/auto.thapi.cc`
- Current branch: `main`
- Current source/dev HEAD: `d3204e5e908224f56a1570a05e5c4f968c902e91`
- `origin/main`: `d3204e5e908224f56a1570a05e5c4f968c902e91`
- Working tree dirt before report edits: pre-existing untracked `tools/forge/__pycache__/`, which the brief identifies as out of scope.

Target discovery:

```bash
test -d /opt/auto-forge-controller && (cd /opt/auto-forge-controller && pwd && git status --short --branch && git rev-parse HEAD && git remote -v) || echo MISSING_TARGET
find /opt -maxdepth 3 -type d \( -name .git -o -name auto-forge-controller -o -name auto-code \) 2>/dev/null | sort
find /var/www /srv /home -maxdepth 4 -type d \( -name .git -o -name auto-forge-controller -o -name auto-code \) 2>/dev/null | sort | head -200
docker ps --format '{{.Names}} {{.Image}} {{.Ports}}' | sort
systemctl list-units --type=service --all 'auto-forge*' 'openclaw*' --no-pager
```

Observed:

- `/opt/auto-forge-controller` returned `MISSING_TARGET`.
- No matching target checkout was found under `/opt`.
- Nearby Git checkouts found under `/var/www` did not include a separate deployed Auto Forge target.
- No Auto Forge or OpenClaw systemd service units are installed on this host.
- Running Docker containers belong to `admin.thapi.cc`, not Auto Forge.

## Validation Not Run

The following required Phase 3 validation commands were intentionally not run because no deployed target checkout exists and the source/dev checkout is not an authorized runtime target:

```bash
npm run verify
docker compose build
docker compose up -d postgres api worker web
docker compose logs --tail=100 api
docker compose logs --tail=100 worker
Telegram /scope @auto-forge-controller smoke
```

## Durable Memory Candidates

- Phase 3 target proof requires a real deployed checkout, commonly `/opt/auto-forge-controller`, before rebuild, service restart, Telegram, OpenClaw, or Codex proof.
- This host currently has only the source/dev checkout at `/var/www/html/auto.thapi.cc`; no deployed target checkout was present during the Phase 3 window.

## Required Next Step

Provision or identify the operator-approved target install path, then pull `d3204e5e908224f56a1570a05e5c4f968c902e91` into that deployed checkout before rerunning Phase 3 validation.
