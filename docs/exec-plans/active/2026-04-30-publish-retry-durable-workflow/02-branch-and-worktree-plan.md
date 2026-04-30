# Branch And Worktree Plan

## Branch

- Work on `main` unless the operator explicitly requests a GitHub branch.
- Push checkpoint commits to `origin/main`.

## Worktree

- `worktree`: `null`
- No `git worktree`, sibling clone, duplicate repo checkout, or alternate local repo path is authorized.

## Topology

- Source/dev checkout: `/var/www/html/auto.thapi.cc`
- Target deployed checkout: `/opt/auto-forge-controller`
- Product repo examples: `/data/repos/coder-frontend`

## Dirty State Rule

Current unrelated generated residue may exist at `tools/forge/__pycache__/`. It is not owned by this brief and must not be committed as part of this pack.

If additional dirty state appears in owned paths, stop and report it before changing branch, resetting, or overwriting.

