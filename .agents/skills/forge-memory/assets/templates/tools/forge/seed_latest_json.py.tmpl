#!/usr/bin/env python3

from __future__ import annotations

import json
import re
import subprocess
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ACTIVE_DIR = REPO_ROOT / "docs" / "exec-plans" / "active"
LINK_RE = re.compile(r"\(([^)]+\.md)\)")
STATUS_RE = re.compile(r"`(QA_CHECKPOINT|FINAL_SHIPGATE|REVISION_PACK_REQUIRED|REPLAN_REQUIRED|BLOCKED_EXTERNAL|CLEAR_CURRENT_PHASE)`")
IMPL_SHA_RE = re.compile(r"implementation_commit_sha[^0-9a-f`]+`?([0-9a-f]{7,40})`?", re.IGNORECASE)


def git_stdout(*args: str) -> str:
    return subprocess.check_output(["git", "-C", str(REPO_ROOT), *args], text=True).strip()


def newest_report_reference(latest_md_path: Path) -> str | None:
    match = LINK_RE.search(latest_md_path.read_text(encoding="utf-8"))
    return match.group(1) if match else None


def implementation_sha_for_reports(reports_dir: Path) -> str | None:
    candidates = sorted(reports_dir.glob("*.md"), reverse=True)
    for candidate in candidates:
        if candidate.name in {"LATEST.md", "README.md"}:
            continue
        match = IMPL_SHA_RE.search(candidate.read_text(encoding="utf-8"))
        if match:
            return match.group(1)
    return None


def main() -> int:
    branch = git_stdout("branch", "--show-current")

    for brief_dir in sorted(path for path in ACTIVE_DIR.iterdir() if path.is_dir()):
        reports_dir = brief_dir / "reports"
        latest_md = reports_dir / "LATEST.md"
        if not latest_md.exists():
            continue

        latest_report_ref = newest_report_reference(latest_md)
        if not latest_report_ref:
            continue

        latest_report_path = reports_dir / latest_report_ref
        if not latest_report_path.exists():
            continue

        latest_report_text = latest_report_path.read_text(encoding="utf-8")
        latest_md_text = latest_md.read_text(encoding="utf-8")
        status_match = STATUS_RE.search(latest_report_text) or STATUS_RE.search(latest_md_text)
        implementation_sha = implementation_sha_for_reports(reports_dir)
        stop_report_sha = git_stdout("log", "-1", "--format=%H", "--", str(latest_report_path.relative_to(REPO_ROOT)))

        payload = {
            "brief_id": brief_dir.name,
            "latest_report": f"reports/{latest_report_path.name}",
            "updated_at": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "stop_status": status_match.group(1) if status_match else None,
            "implementation_commit_sha": implementation_sha,
            "stop_report_commit_sha": stop_report_sha,
            "branch": branch,
        }

        (reports_dir / "LATEST.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
