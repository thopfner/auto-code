# Memory Pack Update

Update durable memory only at final shipgate or if a phase materially changes facts needed by future agents before final shipgate.

## Durable Memory Candidates

Promote these only after implementation and QA proof:

- Auto Forge owns Telegram inbound webhook traffic; OpenClaw must not compete for the same bot inbound path.
- VPS installer calls a managed OpenClaw bootstrap script that creates OpenClaw workspace files.
- OpenClaw workspace files are managed under the configured OpenClaw workspace path.
- Repo switching from Telegram uses a registered repo model and allowed root/path validation.
- SSH keys are generated per repo, stored with private key mode `0600`, and never exposed through Telegram or reports.
- Public deployment URL is runtime-provided through `AUTO_FORGE_PUBLIC_BASE_URL`/installer prompt, not hardcoded.

## Files To Consider At Final Shipgate

- `docs/agent-memory/CURRENT_STATE.md`
- `docs/agent-memory/ARCHITECTURE.md`
- `docs/agent-memory/DECISIONS.md`
- `docs/agent-memory/TESTING.md`
- `docs/agent-memory/SESSION_HANDOFF.md`

