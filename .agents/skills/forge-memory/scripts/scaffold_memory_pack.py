#!/usr/bin/env python3

from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path
import sys


SCRIPT_DIR = Path(__file__).resolve().parent
TEMPLATE_ROOT = SCRIPT_DIR.parent / "assets" / "templates"
EXECUTABLE_TARGETS = {
    Path(".claude/hooks/enforce-validation-level.py"),
    Path(".claude/hooks/enforce-phase-ownership.py"),
    Path(".claude/hooks/require-stop-artifacts.py"),
    Path("tools/forge/seed_automation_state.py"),
    Path("tools/forge/seed_latest_json.py"),
    Path("tools/forge/verify_stop_artifact.py"),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scaffold AGENTS.md, CLAUDE.md, and repo memory docs into a target repo."
    )
    parser.add_argument("--repo-root", required=True, help="Target repository root")
    parser.add_argument("--project-name", help="Project name to render into templates")
    parser.add_argument("--slug", help="Project slug to render into templates")
    parser.add_argument(
        "--include-ui",
        action="store_true",
        help="Also scaffold docs/ui/ templates for frontend or UI-heavy repos",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing files instead of skipping them",
    )
    return parser.parse_args()


def render_text(text: str, context: dict[str, str]) -> str:
    for key, value in context.items():
        text = text.replace(f"__{key}__", value)
    return text


def render_path(relative_path: Path, context: dict[str, str]) -> Path:
    rendered_parts = [render_text(part, context) for part in relative_path.parts]
    rendered = Path(*rendered_parts)
    if rendered.suffix == ".tmpl":
        rendered = rendered.with_suffix("")
    return rendered


def should_mark_executable(target_relative: Path) -> bool:
    return target_relative in EXECUTABLE_TARGETS


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).expanduser().resolve()
    if not repo_root.exists():
        print(f"error: repo root does not exist: {repo_root}", file=sys.stderr)
        return 1

    project_name = args.project_name or repo_root.name
    slug = args.slug or repo_root.name.replace(" ", "-").lower()
    context = {
        "PROJECT_NAME": project_name,
        "PROJECT_SLUG": slug,
        "DATE": date.today().isoformat(),
    }

    created = 0
    skipped = 0
    overwritten = 0

    for template in sorted(TEMPLATE_ROOT.rglob("*")):
        if template.is_dir():
            continue
        relative = template.relative_to(TEMPLATE_ROOT)
        if relative.parts[:2] == ("docs", "ui") and not args.include_ui:
            continue
        target = repo_root / render_path(relative, context)
        target.parent.mkdir(parents=True, exist_ok=True)
        existed = target.exists()

        if existed and not args.force:
            skipped += 1
            print(f"skip  {target}")
            continue

        content = render_text(template.read_text(encoding="utf-8"), context)
        target.write_text(content, encoding="utf-8")
        if should_mark_executable(target.relative_to(repo_root)):
            target.chmod(0o755)

        if existed:
            overwritten += 1
            print(f"write {target}")
        else:
            created += 1
            print(f"write {target}")

    print(
        f"done: created={created} overwritten={overwritten} skipped={skipped} root={repo_root}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
