# Auto Forge Controller Decisions

Last refreshed: 2026-04-28

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
