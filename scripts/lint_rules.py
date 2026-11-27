"""Fail the build on AGENTS.md rules that ESLint cannot see.

ESLint covers TypeScript. This covers the rest:

- Every TODO names its ticket, like TODO(BE-2), so `grep -rn "TODO(BE-2)"` finds
  all of a ticket's work.
- Dashboard CSS uses Dew variables, never a hardcoded hex, rgb() or hsl() color.

Run with: pnpm lint:rules
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Final

REPO_ROOT: Final = Path(__file__).resolve().parent.parent

# Code and config. Prose in docs/ is out of scope: a doc TODO is a writing task,
# not an interface someone implements.
TODO_SUFFIXES: Final[frozenset[str]] = frozenset(
    {".py", ".ts", ".tsx", ".js", ".mjs", ".jsx", ".css", ".sql", ".sh", ".yml", ".yaml", ".toml"}
)
TODO_NAMES: Final[frozenset[str]] = frozenset({"Dockerfile", "pre-commit"})

SKIPPED_DIRECTORIES: Final[frozenset[str]] = frozenset(
    {
        ".git",
        ".claude",
        ".next",
        ".mypy_cache",
        ".pytest_cache",
        ".ruff_cache",
        ".venv",
        "__pycache__",
        "node_modules",
        "dist",
        "build",
        "coverage",
        "docs",
    }
)

# This file spells out the patterns it bans.
SKIPPED_FILES: Final[frozenset[str]] = frozenset({"lint_rules.py"})

# TODO(BE-2) or TODO(AG-2, AG-3).
TICKET_LIST: Final = r"[A-Z]+-\d+(?:, ?[A-Z]+-\d+)*"
UNTICKETED_TODO: Final = re.compile(r"\bTODO\b(?!\(" + TICKET_LIST + r"\))")

DASHBOARD: Final = REPO_ROOT / "apps" / "dashboard"
# Dew's own stylesheets are copied in at build time and define the palette.
DEW_COPY: Final = DASHBOARD / "public" / "dew"

CSS_COMMENT: Final = re.compile(r"/\*.*?\*/", re.DOTALL)
# A declaration ends in ; or }. A selector ends in {, so `#id {` is not a color.
DECLARATION: Final = re.compile(r"[\w-]+\s*:\s*([^;{}]+)(?=[;}])")
COLOR: Final = re.compile(r"#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl)a?\(")


@dataclass(frozen=True, slots=True)
class Violation:
    path: Path
    line_number: int
    found: str
    reason: str

    def render(self) -> str:
        return f"{self.path.relative_to(REPO_ROOT)}:{self.line_number}  {self.found!r}  {self.reason}"


def is_skipped(path: Path) -> bool:
    relative = path.relative_to(REPO_ROOT)
    return path.name in SKIPPED_FILES or any(part in SKIPPED_DIRECTORIES for part in relative.parts)


def read(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return None


def scan_todos(root: Path) -> list[Violation]:
    violations: list[Violation] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or is_skipped(path):
            continue
        if path.suffix not in TODO_SUFFIXES and path.name not in TODO_NAMES:
            continue
        content = read(path)
        if content is None:
            continue
        for line_number, line in enumerate(content.splitlines(), start=1):
            for match in UNTICKETED_TODO.finditer(line):
                violations.append(
                    Violation(path, line_number, match.group(), "TODO needs a ticket, like TODO(BE-2)")
                )
    return violations


def blank_comments(css: str) -> str:
    # Keep the newlines so line numbers still match the file.
    return CSS_COMMENT.sub(lambda match: re.sub(r"[^\n]", " ", match.group()), css)


def scan_colors(root: Path) -> list[Violation]:
    violations: list[Violation] = []
    for path in sorted(root.rglob("*.css")):
        if is_skipped(path) or path.is_relative_to(DEW_COPY):
            continue
        content = read(path)
        if content is None:
            continue
        css = blank_comments(content)
        for declaration in DECLARATION.finditer(css):
            for color in COLOR.finditer(declaration.group(1)):
                offset = declaration.start(1) + color.start()
                line_number = css.count("\n", 0, offset) + 1
                violations.append(
                    Violation(path, line_number, color.group(), "hardcoded color, use a Dew CSS variable")
                )
    return violations


def main() -> int:
    violations = scan_todos(REPO_ROOT) + scan_colors(DASHBOARD)
    if not violations:
        print("rules lint passed")
        return 0

    print(f"rules lint failed with {len(violations)} violation(s):\n")
    for violation in violations:
        print(f"  {violation.render()}")
    print("\nRules live in AGENTS.md section 2.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
