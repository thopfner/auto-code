# Auto Forge Controller Parallel Execution Rules

Last refreshed: 2026-04-29

## Default Topology

- One lead owns planning, integration, and final verification.
- Keep `/var/www/html/auto.thapi.cc` as the only code-writing location for source/dev work.
- Deployable product proof happens through GitHub: push from the source checkout, then pull the accepted commit into the target install, commonly `/opt/auto-forge-controller` on the deployment VPS.
- Do not interpret local `SERVICE_RESTART` validation as permission to run this source checkout as the long-lived product service.
- Use additional teammates for read-only analysis, QA, or serialized handoffs.

## Ownership Rules

- Controller core, schema, and queue state belong to the lead until their interfaces stabilize.
- UI workers may own frontend files only after the API contracts are defined.
- Ops/deployment workers may own Docker, systemd, install scripts, and runbooks only after service names and env contracts are defined.
- No two active workers may edit the same file.

## Branch And Repo-Path Rules

- Treat any request for a new branch or worktree as a GitHub branch request only.
- Do not create `git worktree` directories, sibling clones, or duplicated repo folders.
- Keep all brief, report, automation, and scratch files inside this repo path.
- Keep `automation/state.json`.`worktree` as `null`.

## Dirty Repo Handling

- Dirty state is expected during a phase, but a new phase may not start until the prior phase stop state is committed and reported.
- If unrelated dirty files exist, stop and ask before proceeding.

## Worker Contract

Every worker task must define objective, owned files/modules, non-goals, invariants, verification commands, blocker conditions, and required completion report.

## Stop Conditions

- Stop if implementation would weaken the production go-live bar.
- Stop if Codex, OpenClaw, or Telegram current behavior contradicts the brief.
- Stop if a migration or contract change affects unplanned surfaces.
- Stop if secrets or auth caches would be committed.
