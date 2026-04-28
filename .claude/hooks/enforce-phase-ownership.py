#!/usr/bin/env python3

from __future__ import annotations

import json
import sys
from pathlib import Path

FORGE_DIR = Path(__file__).resolve().parents[2] / "tools" / "forge"
if str(FORGE_DIR) not in sys.path:
    sys.path.insert(0, str(FORGE_DIR))

from automation_context import is_brief_runtime_file, load_context, path_allowed


def load_payload() -> dict[str, object]:
    try:
        return json.load(sys.stdin)
    except json.JSONDecodeError:
        return {}


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
    if payload.get("tool_name") not in {"Edit", "Write"}:
        return 0

    tool_input = payload.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        return 0

    file_path = tool_input.get("file_path")
    if not isinstance(file_path, str) or not file_path.strip():
        return 0

    project_dir = Path(payload.get("cwd") or ".").resolve()
    context = load_context(project_dir, transcript_path=payload.get("transcript_path"))
    if not context.found_brief or context.brief_dir is None or context.state is None:
        return 0

    target_path = Path(file_path).expanduser()
    if not target_path.is_absolute():
        target_path = project_dir / target_path

    if is_brief_runtime_file(project_dir, context.brief_dir, target_path):
        return 0

    status = context.state.get("status")
    if status != "READY_FOR_IMPLEMENTATION":
        return block(
            f"{context.brief_id} is {status or 'missing-status'}; only the active brief reports/automation files may be edited until QA authorizes the next execution window."
        )

    owned_paths = context.state.get("owned_paths")
    if not isinstance(owned_paths, list) or not owned_paths:
        return block(
            f"{context.brief_id} is missing V3A owned_paths for the current phase. QA or planning must define them before implementation edits continue."
        )

    if path_allowed(project_dir, context.brief_dir, target_path, [str(path) for path in owned_paths]):
        return 0

    return block(
        f"{target_path} is outside the current V3A owned_paths for {context.brief_id}. Revise automation/state.json via QA before editing outside the authorized phase scope."
    )


if __name__ == "__main__":
    raise SystemExit(main())
