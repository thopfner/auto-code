#!/usr/bin/env python3

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

FORGE_DIR = Path(__file__).resolve().parents[2] / "tools" / "forge"
if str(FORGE_DIR) not in sys.path:
    sys.path.insert(0, str(FORGE_DIR))

from automation_context import (
    command_allowed,
    explicit_allowed_commands,
    load_context,
    normalize_command,
    phase_path_from_state,
    read_text,
    validation_level_from_text,
)


def load_payload() -> dict[str, object]:
    try:
        return json.load(sys.stdin)
    except json.JSONDecodeError:
        return {}


def classify_command(command: str) -> str | None:
    cmd = normalize_command(command)
    if re.search(r"\bdocker\s+compose\s+build\b|\bdocker\s+build\b|\bnpm\b.*\brun\s+build\b|\bnext\s+build\b", cmd):
        return "rebuild"
    if re.search(r"\bdocker\s+compose\s+up\b", cmd):
        return "recreate"
    if re.search(
        r"\bdocker\s+compose\s+restart\b|\bdocker\s+restart\b|\bsystemctl\s+restart\b|\bservice\b.*\brestart\b|\bsupervisorctl\s+restart\b|\bpm2\s+restart\b",
        cmd,
    ):
        return "restart"
    return None


def block(reason: str) -> int:
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                }
            }
        )
    )
    return 0


def main() -> int:
    payload = load_payload()
    if payload.get("tool_name") != "Bash":
        return 0

    tool_input = payload.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        return 0

    command = tool_input.get("command")
    if not isinstance(command, str) or not command.strip():
        return 0

    project_dir = Path(payload.get("cwd") or ".").resolve()
    context = load_context(project_dir, transcript_path=payload.get("transcript_path"))
    if not context.found_brief or context.brief_dir is None:
        return 0

    phase_path = phase_path_from_state(context.brief_dir, context.state)
    phase_text = read_text(phase_path) if phase_path and phase_path.exists() else None
    readme_path = context.brief_dir / "README.md"
    readme_text = read_text(readme_path) if readme_path.exists() else None

    allowed_commands = {
        normalize_command(command_text)
        for command_text in (context.state or {}).get("allowed_commands", [])
        if isinstance(command_text, str)
    }
    if not allowed_commands:
        allowed_commands = explicit_allowed_commands(*(text for text in [phase_text, readme_text] if text))

    normalized = normalize_command(command)
    if command_allowed(command, allowed_commands):
        return 0

    command_kind = classify_command(command)
    if command_kind is None:
        return 0

    validation_level = (context.state or {}).get("validation_level")
    if not isinstance(validation_level, str) or not validation_level:
        validation_level = validation_level_from_text(phase_text, readme_text)
    if not validation_level:
        return 0

    phase_label = (context.state or {}).get("authorized_phase")
    if not isinstance(phase_label, str) or not phase_label.strip():
        phase_label = phase_path.name if phase_path else (context.brief_id or "unknown-brief")

    validation_level = validation_level.upper()
    if validation_level in {"NO_RUNTIME_CHECK", "LIVE_RELOAD"} and command_kind in {"rebuild", "recreate", "restart"}:
        return block(
            f"{phase_label} is {validation_level}; runtime-changing Bash command denied: {normalized}. "
            "Use the planned cheaper validation path or revise automation/state.json and the brief first."
        )

    if validation_level == "SERVICE_RESTART" and command_kind in {"rebuild", "recreate"}:
        return block(
            f"{phase_label} is SERVICE_RESTART; rebuild/recreate command denied: {normalized}. "
            "Use the explicitly allowed service-scoped command family for the affected service, or revise the brief and automation/state.json first."
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
