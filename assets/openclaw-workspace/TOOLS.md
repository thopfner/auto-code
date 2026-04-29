<!-- AUTO_FORGE_MANAGED_OPENCLAW_WORKSPACE v1 -->

# Tool Boundaries

Auto Forge Controller owns:

- task lifecycle state
- repo locks and queueing
- Codex runner dispatch
- QA checkpoints and final shipgates
- Telegram slash commands and inbound webhook ownership
- setup JSON and runtime secret references

OpenClaw may help with local gateway status and outbound helper checks. It must not configure long polling or a webhook for the same Telegram bot in this phase.
