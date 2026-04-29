# Auto Forge Controller Claude Code Memory

@AGENTS.md

## Claude-Specific Rules

- Run Claude from the repo root so project hooks under `.claude/` can load.
- Do not use `claude --bare` for brief-driven work because bare mode skips repo hooks.
- Treat the active repo path as the only source code-writing location. `/var/www/html/auto.thapi.cc` is the source/dev checkout unless the operator explicitly designates it as the deployed runtime.
- Production deployment proof flows through GitHub into the target install, commonly `/opt/auto-forge-controller`; do not leave services running from the source/dev checkout as if it were production.
- If a user asks for a new branch or worktree, interpret that as a GitHub branch request only.
- Keep one owner per file set. The lead integrates and resolves shared interfaces.
- Require a plan before editing when the task touches schema, auth, payments, or shared contracts.
- If the repo is dirty or docs appear stale, summarize the mismatch before acting.
- If the active repo is dirty and no explicit dirty-repo topology policy is documented, stop and ask before changing branches or repo paths. Do not create `git worktree` directories or duplicate repo checkouts.
