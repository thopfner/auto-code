#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path

from automation_context import infer_phase_from_report, load_json, validation_level_from_text, read_text

REPO_ROOT = Path(__file__).resolve().parents[2]
ACTIVE_DIR = REPO_ROOT / "docs" / "exec-plans" / "active"


def git_stdout(*args: str) -> str:
    return subprocess.check_output(["git", "-C", str(REPO_ROOT), *args], text=True).strip()


def current_timestamp() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def seed_brief(brief_dir: Path, branch: str, force: bool) -> None:
    reports_latest = load_json(brief_dir / "reports" / "LATEST.json") or {}
    latest_report = reports_latest.get("latest_report")
    phase_path = infer_phase_from_report(brief_dir, latest_report if isinstance(latest_report, str) else None)
    phase_text = read_text(phase_path) if phase_path and phase_path.exists() else ""
    validation_level = validation_level_from_text(phase_text) or "NO_RUNTIME_CHECK"
    stop_status = reports_latest.get("stop_status")

    automation_dir = brief_dir / "automation"
    automation_dir.mkdir(parents=True, exist_ok=True)
    state_path = automation_dir / "state.json"
    qa_path = automation_dir / "qa.json"

    if state_path.exists() and not force:
        state = load_json(state_path) or {}
    else:
        state = {
            "brief_id": brief_dir.name,
            "authorized_phase": phase_path.name if phase_path else None,
            "status": "BLOCKED_EXTERNAL" if stop_status == "BLOCKED_EXTERNAL" else "WAITING_FOR_QA",
            "read_mode": "BRIEF_REHYDRATE",
            "validation_level": validation_level,
            "owned_paths": [],
            "allowed_commands": [],
            "branch": branch,
            "worktree": None,
            "updated_at": current_timestamp(),
        }

    if qa_path.exists() and not force:
        qa = load_json(qa_path) or {}
    else:
        qa = {
            "brief_id": brief_dir.name,
            "qa_status": stop_status or "NOT_REVIEWED",
            "last_reviewed_phase": phase_path.name if phase_path else None,
            "next_authorized_phase": None,
            "latest_report": latest_report,
            "implementation_commit_sha": reports_latest.get("implementation_commit_sha"),
            "stop_report_commit_sha": reports_latest.get("stop_report_commit_sha"),
            "finding_types": [],
            "updated_at": current_timestamp(),
        }

    state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    qa_path.write_text(json.dumps(qa, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    branch = git_stdout("branch", "--show-current")
    for brief_dir in sorted(path for path in ACTIVE_DIR.iterdir() if path.is_dir()):
        seed_brief(brief_dir, branch, args.force)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
