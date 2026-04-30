# Auto Forge Controller Decisions

Last refreshed: 2026-04-30

## Durable Decisions

### 2026-04-28: Use TypeScript, npm, Fastify, React/Vite, and SQL Migrations

- Status: accepted
- Context: Phase 1 needed a stack that supports a web onboarding UI, controller API, background worker, CLI, durable migrations, fake adapters, and deterministic tests without depending on live Telegram/OpenClaw/Codex services.
- Decision: Use a TypeScript/npm foundation with Fastify for the API, React/Vite for the web app, Node worker/CLI entry points, Zod for configuration validation, SQL migration files for Postgres-first persistence, and Vitest/ESLint/TypeScript for verification.
- Consequences: The first implementation path is friendly to OpenClaw/Codex SDK integration while keeping tests fake-adapter driven. `npm` is the committed package manager because it is available in the target repo environment.
- Revisit when: A later phase proves the Codex/OpenClaw SDK path requires a different runtime or package manager.

### 2026-04-28: Build a Custom Forge Controller

- Status: accepted
- Context: The manual Forge workflow works but requires copying prompts and watching CLI sessions.
- Decision: Build a dedicated controller that owns durable state, queueing, repo locks, runner dispatch, artifact validation, and recovery.
- Consequences: OpenClaw remains the chat interface, but it does not become the source of Forge workflow truth.
- Revisit when: OpenClaw TaskFlow exposes all Forge-specific state transitions and artifact checks natively.

### 2026-04-28: Keep Telegram and OpenClaw as the Human Control Plane

- Status: accepted
- Context: The operator wants to stay out of the CLI and work from Telegram.
- Decision: Telegram slash commands route through OpenClaw into the controller; controller responses go back through OpenClaw.
- Consequences: The product must include OpenClaw onboarding, gateway health checks, and Telegram command setup.
- Revisit when: A future native mobile or web app becomes the preferred operator interface.

### 2026-04-28: Vendor a Repo-Local Forge Skill Clone

- Status: accepted
- Context: The global Forge skills under `/opt/forge-skills` should not be modified for this project.
- Decision: Copy Forge skills into repo-local `auto-forge-*` skills under `.agents/skills/forge-*` plus `.agents/skills/references/` so this repo has portable agent instructions.
- Consequences: Project-specific evolution happens in this repo; upstream syncs must be intentional.
- Revisit when: The project publishes its own plugin or skill package.

### 2026-04-28: Tmux Is Observability, Not Orchestration

- Status: accepted
- Context: Tmux sessions are useful for watching agents but fragile as durable workflow state.
- Decision: Use database state, queues, logs, and artifacts as truth; tmux may be generated for operator visibility.
- Consequences: SSH disconnects or tmux failures must not lose task state.
- Revisit when: None expected.

### 2026-04-29: Auto Forge Owns Shared Telegram Inbound

- Status: accepted
- Context: The VPS installer integrates both Auto Forge and OpenClaw, but a Telegram bot can have only one webhook owner.
- Decision: Auto Forge owns inbound Telegram slash commands at `${AUTO_FORGE_PUBLIC_BASE_URL}/telegram/webhook`; OpenClaw is kept as a local gateway/helper and must not compete for the same bot inbound path.
- Consequences: Installer and live-smoke behavior must preserve controller webhook registration and treat OpenClaw Telegram delivery as optional diagnostics unless a later brief designs a separate mediated chat path.
- Revisit when: A future integration gives OpenClaw a separate bot or an explicit controller-mediated inbound contract.

### 2026-04-29: Bootstrap OpenClaw With Managed Workspace Files

- Status: accepted
- Context: Fresh OpenClaw installs could otherwise enter generic first-run bootstrap behavior before Auto Forge context is present.
- Decision: The VPS installer calls `scripts/setup-openclaw.sh`, which generates managed OpenClaw workspace markdown from repo templates and sets workspace/gateway config through supported CLI paths where available.
- Consequences: Fresh VPS installs receive Auto Forge-specific OpenClaw context without manual markdown editing. Managed files can be rerun idempotently and must not contain secrets.
- Revisit when: OpenClaw exposes a first-class project bootstrap API that replaces file/template management.

### 2026-04-29: Use Registered Repo Aliases For Telegram Repo Switching

- Status: accepted
- Context: Letting Telegram commands point at arbitrary filesystem paths would break repo locks and create unsafe mutation boundaries.
- Decision: Repo switching uses registered aliases, allowed-root realpath validation, symlink escape rejection, pause/resume controls, audit events, and active-task switch blocking.
- Consequences: `/scope` can target the active repo or an explicit `@alias`, while repo mutations remain serialized and auditable.
- Revisit when: Durable multi-user permissions or safe parallel branch ownership are implemented.

### 2026-04-29: Manage GitHub Access With Repo-Scoped Deploy Keys

- Status: accepted
- Context: New VPS installs need repo access without reusing broad personal SSH keys or exposing private material in chat.
- Decision: Generate per-repo Ed25519 keys under `AUTO_FORGE_SSH_KEY_ROOT` or `/etc/auto-forge-controller/ssh`; expose only public key/fingerprint; validate read with SSH `git ls-remote`; validate intended write with `git push --dry-run`; add GitHub deploy keys through API only when an appropriate token is configured.
- Consequences: Deploy keys default to read-only and write access requires explicit `--write`. Private keys remain on controller disk with mode `0600`.
- Revisit when: A GitHub App installation model replaces deploy keys for repo access.

### 2026-04-30: Use Postgres For Deployed Workflow State

- Status: accepted
- Context: The deployed controller lost product repo registrations, active repo selections, and task history across service restart because production still used `MemoryWorkflowStore`.
- Decision: When `DATABASE_URL` is configured, the API uses a Postgres-backed `WorkflowStore`; deterministic tests and local harnesses without `DATABASE_URL` keep the in-memory store.
- Consequences: Product repo onboarding is a one-time setup per deployed database rather than a repeated manual step after every deploy. Existing in-memory state from old processes cannot be recovered unless it was also recorded elsewhere.
- Revisit when: The workflow engine moves to a dedicated queue worker and needs transactional leases or advisory locks in the same store.
