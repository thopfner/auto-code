#!/usr/bin/env python3

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

FORGE_DIR = Path(__file__).resolve().parents[2] / "tools" / "forge"
if str(FORGE_DIR) not in sys.path:
    sys.path.insert(0, str(FORGE_DIR))

from automation_context import load_context


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    project_dir = Path(payload.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or ".").resolve()
    verifier = project_dir / "tools" / "forge" / "verify_stop_artifact.py"
    if not verifier.exists():
        return 0

    context = load_context(project_dir, transcript_path=payload.get("transcript_path"))
    cmd = [
        sys.executable,
        str(verifier),
        "--project-dir",
        str(project_dir),
        "--format",
        "json",
        "--enforcement",
        "stop",
    ]
    if context.brief_dir is not None:
        cmd.extend(["--brief-dir", str(context.brief_dir)])
    elif payload.get("transcript_path"):
        cmd.extend(["--transcript-path", payload["transcript_path"]])

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode not in (0, 1):
        return 0

    try:
        data = json.loads(result.stdout or "{}")
    except json.JSONDecodeError:
        return 0

    if not data.get("found_brief") or data.get("ok", True):
        return 0

    brief_id = data.get("brief_id") or "unknown-brief"
    errors = data.get("errors") or []
    summary = "; ".join(errors[:3])
    if len(errors) > 3:
        summary = f"{summary}; plus {len(errors) - 3} more issue(s)"

    reason = (
        f"Stop blocked for brief {brief_id}: {summary}. "
        "Write or refresh the timestamped stop report, refresh reports/LATEST.json, "
        "and keep the stop-report SHAs truthful before stopping again."
    )
    print(json.dumps({"decision": "block", "reason": reason}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
