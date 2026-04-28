from __future__ import annotations

import fnmatch
import json
import re
import shlex
from dataclasses import dataclass
from pathlib import Path
from typing import Any

BRIEF_RE = re.compile(r"docs/exec-plans/active/([A-Za-z0-9._-]+)/")
PHASE_TOKEN_RE = re.compile(r"(phase-[a-z0-9]+)", re.IGNORECASE)
VALIDATION_RE = re.compile(
    r"Validation level:\s*`(NO_RUNTIME_CHECK|LIVE_RELOAD|SERVICE_RESTART|FULL_REBUILD)`",
    re.IGNORECASE,
)
EXECUTION_MODE_RE = re.compile(r"Execution mode:\s*`(AUTONOMOUS|QA_CHECKPOINT|FINAL_SHIPGATE)`", re.IGNORECASE)
COMPOSE_GLOBAL_FLAGS_WITH_VALUE = {"-f", "--file", "-p", "--project-name", "--profile", "--env-file"}


@dataclass
class AutomationContext:
    found_brief: bool
    brief_id: str | None
    brief_dir: Path | None
    state_path: Path | None
    state: dict[str, Any] | None
    qa_path: Path | None
    qa: dict[str, Any] | None


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def load_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        data = json.loads(read_text(path))
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def infer_brief_dir(project_dir: Path, transcript_path: str | None) -> Path | None:
    if transcript_path:
        transcript = Path(transcript_path)
        if transcript.exists():
            matches = list(BRIEF_RE.finditer(read_text(transcript)))
            if matches:
                brief_id = matches[-1].group(1)
                return project_dir / "docs" / "exec-plans" / "active" / brief_id

    active_dir = project_dir / "docs" / "exec-plans" / "active"
    if not active_dir.exists():
        return None

    candidates = [
        path
        for path in sorted(active_dir.iterdir())
        if path.is_dir() and (path / "automation" / "state.json").exists()
    ]
    return candidates[0] if len(candidates) == 1 else None


def load_context(
    project_dir: Path,
    transcript_path: str | None = None,
    brief_dir: Path | None = None,
) -> AutomationContext:
    resolved_brief_dir = brief_dir.resolve() if brief_dir else infer_brief_dir(project_dir, transcript_path)
    if resolved_brief_dir is None:
        return AutomationContext(False, None, None, None, None, None, None)

    brief_id = resolved_brief_dir.name
    automation_dir = resolved_brief_dir / "automation"
    state_path = automation_dir / "state.json"
    qa_path = automation_dir / "qa.json"
    return AutomationContext(
        True,
        brief_id,
        resolved_brief_dir,
        state_path,
        load_json(state_path),
        qa_path,
        load_json(qa_path),
    )


def normalize_command(command: str) -> str:
    command = re.sub(r"\\\s*\n", " ", command)
    return " ".join(command.strip().split())


def shell_split(command: str) -> list[str]:
    try:
        return shlex.split(command)
    except ValueError:
        return normalize_command(command).split()


def explicit_allowed_commands(*texts: str) -> set[str]:
    commands: set[str] = set()
    in_block = False
    current: list[str] = []

    def flush() -> None:
        nonlocal current
        if current:
            commands.add(normalize_command(" ".join(current)))
            current = []

    for text in texts:
        for raw_line in text.splitlines():
            stripped = raw_line.strip()
            if stripped.startswith("```"):
                if in_block:
                    flush()
                in_block = not in_block
                continue
            if not in_block:
                continue
            if not stripped or stripped.startswith("#"):
                flush()
                continue
            continued = stripped.endswith("\\")
            current.append(stripped[:-1].strip() if continued else stripped)
            if not continued:
                flush()
        flush()

    return {command for command in commands if command}


def docker_compose_runtime_signature(command: str) -> tuple[tuple[str, ...], str] | None:
    tokens = shell_split(command)
    compose_index = None
    for index in range(len(tokens) - 1):
        if tokens[index] == "docker" and tokens[index + 1] == "compose":
            compose_index = index
            break
    if compose_index is None:
        return None

    index = compose_index + 2
    while index < len(tokens):
        token = tokens[index]
        if token in COMPOSE_GLOBAL_FLAGS_WITH_VALUE:
            index += 2
            continue
        if token.startswith("-"):
            index += 1
            continue
        action = token
        break
    else:
        return None

    if action not in {"up", "build", "restart"}:
        return None

    index += 1
    services: list[str] = []
    while index < len(tokens):
        token = tokens[index]
        if token in COMPOSE_GLOBAL_FLAGS_WITH_VALUE:
            index += 2
            continue
        if token.startswith("-"):
            index += 1
            continue
        services.append(token)
        index += 1

    if not services:
        return None
    return tuple(sorted(services)), action


def command_allowed(command: str, allowed_commands: set[str]) -> bool:
    normalized = normalize_command(command)
    if normalized in allowed_commands:
        return True

    actual_signature = docker_compose_runtime_signature(normalized)
    if actual_signature is None:
        return False

    actual_services, _ = actual_signature
    for allowed_command in allowed_commands:
        allowed_signature = docker_compose_runtime_signature(allowed_command)
        if allowed_signature is None:
            continue
        allowed_services, _ = allowed_signature
        if allowed_services == actual_services:
            return True
    return False


def phase_path_from_state(brief_dir: Path, state: dict[str, Any] | None) -> Path | None:
    if not state:
        return None

    phase_ref = state.get("authorized_phase")
    if not isinstance(phase_ref, str) or not phase_ref.strip():
        return None

    phase_path = Path(phase_ref)
    if phase_path.is_absolute():
        return phase_path
    if phase_ref.startswith("docs/exec-plans/active/"):
        return brief_dir.parents[2] / phase_ref
    return brief_dir / phase_ref


def validation_level_from_text(*texts: str | None) -> str | None:
    for text in texts:
        if not text:
            continue
        match = VALIDATION_RE.search(text)
        if match:
            return match.group(1).upper()
    return None


def execution_mode_from_text(*texts: str | None) -> str | None:
    for text in texts:
        if not text:
            continue
        match = EXECUTION_MODE_RE.search(text)
        if match:
            return match.group(1).upper()
    return None


def repo_relative_path(project_dir: Path, target_path: Path) -> str | None:
    try:
        return target_path.resolve().relative_to(project_dir.resolve()).as_posix()
    except ValueError:
        return None


def auto_allowed_patterns(project_dir: Path, brief_dir: Path) -> list[str]:
    rel_brief = brief_dir.resolve().relative_to(project_dir.resolve()).as_posix()
    return [
        f"{rel_brief}/reports/*",
        f"{rel_brief}/reports/**",
        f"{rel_brief}/automation/*",
        f"{rel_brief}/automation/**",
    ]


def path_matches_patterns(rel_path: str, patterns: list[str]) -> bool:
    for raw_pattern in patterns:
        pattern = raw_pattern.lstrip("./")
        if fnmatch.fnmatch(rel_path, pattern):
            return True
        if pattern.endswith("/**"):
            prefix = pattern[:-3].rstrip("/")
            if rel_path == prefix or rel_path.startswith(prefix + "/"):
                return True
    return False


def is_brief_runtime_file(project_dir: Path, brief_dir: Path, target_path: Path) -> bool:
    rel_path = repo_relative_path(project_dir, target_path)
    if rel_path is None:
        return False
    return path_matches_patterns(rel_path, auto_allowed_patterns(project_dir, brief_dir))


def path_allowed(project_dir: Path, brief_dir: Path, target_path: Path, owned_paths: list[str]) -> bool:
    rel_path = repo_relative_path(project_dir, target_path)
    if rel_path is None:
        return False
    patterns = list(owned_paths) + auto_allowed_patterns(project_dir, brief_dir)
    return path_matches_patterns(rel_path, patterns)


def newest_phase_files(brief_dir: Path) -> list[Path]:
    return sorted(
        [
            path
            for path in brief_dir.glob("*.md")
            if path.name not in {"README.md", "00-coding-agent-prompt.md", "01-brief-lineage-and-sources.md"}
            and not path.name.startswith(("02-", "03-", "90-", "99-"))
        ]
    )


def phase_token(text: str | None) -> str | None:
    if not text:
        return None
    match = PHASE_TOKEN_RE.search(text)
    return match.group(1).lower() if match else None


def infer_phase_from_report(brief_dir: Path, latest_report: str | None) -> Path | None:
    phases = newest_phase_files(brief_dir)
    token = phase_token(latest_report)
    if token:
        matching = [path for path in phases if token in path.name.lower()]
        if matching:
            return matching[-1]
    return phases[-1] if phases else None
