# Branch And Repo Path Plan

## Branch

- Target branch: `main`
- Current local HEAD at planning time: `fb04200e298ed54daaf305ae45ae2a4fe9cf02b0`
- Remote at planning time: `origin/main` matched local `HEAD`.

## Repo Path

- Active repo path: `/var/www/html/auto.thapi.cc`
- Reviewed VPS deployment path: `/opt/auto-forge-controller`

## Worktree Policy

No `git worktree` directory, sibling clone, or duplicate repo checkout is authorized.

If a new branch is needed, create or switch a GitHub branch inside the active repo path only after explicit operator approval.

## Dirty State

Planning observed only:

```text
?? tools/forge/__pycache__/
```

That path is not owned by this brief. Workers must leave it untouched unless a future explicit cleanup task owns it.

## Ownership

This is a single-worker implementation pack unless the operator explicitly delegates disjoint workers later.

The first authorized worker owns:

- `docker-compose.yml`
- `scripts/install-vps.sh`
- `packages/adapters/src/codex-runner.ts`
- `packages/core/src/**` only where needed for artifact/prompt/root or retry behavior
- `apps/api/src/server.ts` only where needed for runtime env defaults
- `packages/ops/src/health.ts`
- `packages/ops/src/paths.ts`
- `apps/cli/src/index.ts` only where needed for host/container path handling
- `packages/ops/src/vps-setup.ts` only where needed for setup/runtime path handling
- targeted tests under `tests/**`
- deployment docs under `docs/deployment/**`
- this brief directory

Do not edit unrelated frontend UI surfaces or repo-management behavior unless directly required by this runtime repair.
