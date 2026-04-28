#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path

from automation_context import load_context, phase_path_from_state, read_text

SHA_RE = re.compile(r"`?([0-9a-f]{7,40})`?", re.IGNORECASE)
FULL_SHA_RE = re.compile(r"[0-9a-f]{40}", re.IGNORECASE)


@dataclass
class ValidationResult:
    found_brief: bool
    ok: bool
    brief_id: str | None
    brief_dir: str | None
    errors: list[str]
    warnings: list[str]


def git_resolve_commit(project_dir: Path, sha: str) -> str | None:
    proc = subprocess.run(
        ["git", "-C", str(project_dir), "rev-parse", "--verify", f"{sha}^{{commit}}"],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        return None
    return proc.stdout.strip()


def validate_commit_sha(project_dir: Path, sha: object, field_name: str, errors: list[str]) -> None:
    if not isinstance(sha, str):
        errors.append(f"{field_name} is missing from reports/LATEST.json and the referenced stop report")
        return
    if not SHA_RE.fullmatch(sha):
        errors.append(f"{field_name} is not a valid commit SHA: {sha}")
        return
    resolved = git_resolve_commit(project_dir, sha)
    if resolved is None:
        errors.append(f"{field_name} is not a valid commit in this repo: {sha}")
        return
    if not FULL_SHA_RE.fullmatch(sha):
        errors.append(f"{field_name} must be a full 40-character commit SHA; {sha} resolves to {resolved}")


def extract_sha(markdown: str, field_name: str) -> str | None:
    pattern = re.compile(rf"{re.escape(field_name)}[^0-9a-f`]+`?([0-9a-f]{{7,40}})`?", re.IGNORECASE)
    match = pattern.search(markdown)
    return match.group(1) if match else None


def resolve_report_path(brief_dir: Path, report_ref: str) -> Path:
    report_path = Path(report_ref)
    if report_path.is_absolute():
        return report_path
    if report_ref.startswith("reports/"):
        return brief_dir / report_ref
    return brief_dir / "reports" / report_ref


def expected_state_statuses(latest_stop_status: object) -> tuple[set[str], str]:
    if latest_stop_status == "BLOCKED_EXTERNAL":
        return {"BLOCKED_EXTERNAL", "CLEARED"}, "BLOCKED_EXTERNAL or CLEARED"
    if latest_stop_status in {"CLEAR_CURRENT_PHASE", "REVISION_PACK_REQUIRED", "REPLAN_REQUIRED"}:
        return {"READY_FOR_IMPLEMENTATION", "CLEARED"}, "READY_FOR_IMPLEMENTATION or CLEARED"
    return {"WAITING_FOR_QA", "CLEARED"}, "WAITING_FOR_QA or CLEARED"


def validate(
    project_dir: Path,
    brief_dir: Path | None,
    transcript_path: str | None,
    enforcement: str = "full",
) -> ValidationResult:
    context = load_context(project_dir, transcript_path=transcript_path, brief_dir=brief_dir)
    if not context.found_brief or context.brief_dir is None:
        return ValidationResult(False, True, None, None, [], [])

    errors: list[str] = []
    warnings: list[str] = []
    brief_id = context.brief_id
    brief_dir = context.brief_dir
    reports_dir = brief_dir / "reports"
    latest_md = reports_dir / "LATEST.md"
    latest_json = reports_dir / "LATEST.json"

    if not latest_md.exists() and enforcement == "full":
        errors.append("reports/LATEST.md is missing")
    elif not latest_md.exists():
        warnings.append("reports/LATEST.md is missing")
    if not latest_json.exists():
        errors.append("reports/LATEST.json is missing")

    latest_md_text = read_text(latest_md) if latest_md.exists() else ""
    latest_json_data: dict[str, object] = {}
    if latest_json.exists():
        try:
            latest_json_data = json.loads(read_text(latest_json))
        except json.JSONDecodeError as exc:
            errors.append(f"reports/LATEST.json is not valid JSON: {exc}")

    if latest_json_data:
        report_text = ""
        if latest_json_data.get("brief_id") != brief_id:
            errors.append("reports/LATEST.json brief_id does not match the brief folder")
        if not latest_json_data.get("updated_at"):
            errors.append("reports/LATEST.json updated_at is missing")
        if not latest_json_data.get("stop_status"):
            errors.append("reports/LATEST.json stop_status is missing")

        latest_report = latest_json_data.get("latest_report")
        if not isinstance(latest_report, str) or not latest_report.strip():
            errors.append("reports/LATEST.json latest_report is missing")
        else:
            report_path = resolve_report_path(brief_dir, latest_report)
            if not report_path.exists():
                errors.append(f"reports/LATEST.json latest_report does not exist: {latest_report}")
            elif report_path.name in {"LATEST.md", "README.md"}:
                errors.append("reports/LATEST.json latest_report must point at a timestamped stop report, not LATEST.md")
            elif latest_md.exists() and enforcement == "full":
                report_text = read_text(report_path)
                if latest_md_text != report_text and report_path.name not in latest_md_text:
                    errors.append(
                        "reports/LATEST.md neither mirrors nor references the stop report referenced by reports/LATEST.json"
                    )
            elif latest_md.exists() and enforcement == "stop":
                report_text = read_text(report_path)
                if latest_md_text != report_text and report_path.name not in latest_md_text:
                    warnings.append(
                        "reports/LATEST.md neither mirrors nor references the stop report referenced by reports/LATEST.json"
                    )
            else:
                report_text = read_text(report_path)

        implementation_commit_sha = latest_json_data.get("implementation_commit_sha")
        if not isinstance(implementation_commit_sha, str) or not SHA_RE.fullmatch(implementation_commit_sha):
            implementation_commit_sha = extract_sha(report_text, "implementation_commit_sha") or extract_sha(
                latest_md_text, "implementation_commit_sha"
            )
        validate_commit_sha(project_dir, implementation_commit_sha, "implementation_commit_sha", errors)

        stop_report_commit_sha = latest_json_data.get("stop_report_commit_sha")
        if not isinstance(stop_report_commit_sha, str) or not SHA_RE.fullmatch(stop_report_commit_sha):
            stop_report_commit_sha = extract_sha(report_text, "stop_report_commit_sha") or extract_sha(
                latest_md_text, "stop_report_commit_sha"
            )
        validate_commit_sha(project_dir, stop_report_commit_sha, "stop_report_commit_sha", errors)

    if context.state is not None and enforcement == "full":
        if context.state.get("brief_id") != brief_id:
            errors.append("automation/state.json brief_id does not match the brief folder")
        if not context.state.get("updated_at"):
            errors.append("automation/state.json updated_at is missing")
        phase_path = phase_path_from_state(brief_dir, context.state)
        if phase_path is None or not phase_path.exists():
            errors.append("automation/state.json authorized_phase is missing or does not exist")
        state_status = context.state.get("status")
        latest_stop_status = latest_json_data.get("stop_status")
        expected_statuses, expected_label = expected_state_statuses(latest_stop_status)
        if state_status not in expected_statuses:
            errors.append(
                f"automation/state.json status must be {expected_label} for stop_status "
                f"{latest_stop_status or 'the current stop report'}; found {state_status or 'missing'}"
            )

    if context.state is not None and enforcement == "stop":
        if context.state.get("brief_id") != brief_id:
            warnings.append("automation/state.json brief_id does not match the brief folder")
        if not context.state.get("updated_at"):
            warnings.append("automation/state.json updated_at is missing")

    if context.qa is not None and enforcement == "full":
        if context.qa.get("brief_id") != brief_id:
            errors.append("automation/qa.json brief_id does not match the brief folder")
        if not context.qa.get("updated_at"):
            errors.append("automation/qa.json updated_at is missing")

    if context.qa is not None and enforcement == "stop":
        if context.qa.get("brief_id") != brief_id:
            warnings.append("automation/qa.json brief_id does not match the brief folder")
        if not context.qa.get("updated_at"):
            warnings.append("automation/qa.json updated_at is missing")

    return ValidationResult(True, not errors, brief_id, str(brief_dir), errors, warnings)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-dir", default=".")
    parser.add_argument("--brief-dir")
    parser.add_argument("--transcript-path")
    parser.add_argument("--enforcement", choices=["full", "stop"], default="full")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    args = parser.parse_args()

    project_dir = Path(args.project_dir).resolve()
    brief_dir = Path(args.brief_dir).resolve() if args.brief_dir else None
    result = validate(project_dir, brief_dir, args.transcript_path, enforcement=args.enforcement)

    if args.format == "json":
        print(json.dumps(asdict(result), sort_keys=True))
    else:
        if not result.found_brief:
            print("No active brief inferred. Skipping stop-artifact validation.")
        elif result.ok:
            print(f"Stop artifacts valid for {result.brief_id}.")
            for warning in result.warnings:
                print(f"! {warning}")
        else:
            print(f"Stop artifacts invalid for {result.brief_id}:")
            for error in result.errors:
                print(f"- {error}")
            for warning in result.warnings:
                print(f"! {warning}")

    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
