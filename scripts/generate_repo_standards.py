#!/usr/bin/env python3
"""Generate standardized repo starter packs for consolidation targets.

Outputs complete governance + CI starter files for each target repository:
- README.md
- CHANGELOG.md
- CONTRIBUTING.md
- SECURITY.md
- .github/workflows/repo-standards.yml
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import date
from pathlib import Path


@dataclass(frozen=True)
class TargetRepo:
    name: str
    purpose: str
    primary_stack: str
    scope_summary: str
    first_milestone: str
    owners: str


TARGETS = [
    TargetRepo(
        name="codex-core",
        purpose="Execution governance + architecture source of truth",
        primary_stack="HTML/TypeScript documentation + dashboard UI",
        scope_summary=(
            "Merge protocol execution dashboards with architecture mapping "
            "for a single operational control plane."
        ),
        first_milestone=(
            "Ship protocol dashboard + architecture map with synchronized "
            "release notes."
        ),
        owners="@edwardemoryphotography",
    ),
    TargetRepo(
        name="neurofeedback-stack",
        purpose="Real-time EEG and biometrics integration platform",
        primary_stack="Python backend + web dashboard + Docker",
        scope_summary=(
            "Unify Muse EEG ingestion, signal analysis, session telemetry, "
            "and CI-tested deployment flows."
        ),
        first_milestone=(
            "Run end-to-end Muse stream -> processing -> dashboard with "
            "containerized local bring-up."
        ),
        owners="@edwardemoryphotography",
    ),
    TargetRepo(
        name="memory-intelligence",
        purpose="Persistent memory and learning extraction platform",
        primary_stack="Python services + CLI/Desktop clients",
        scope_summary=(
            "Combine scoped memory persistence, retrieval APIs, and "
            "cross-session preference extraction."
        ),
        first_milestone=(
            "Store and retrieve session memories with project/user isolation "
            "and documented retention policy."
        ),
        owners="@edwardemoryphotography",
    ),
    TargetRepo(
        name="agent-tooling-hub",
        purpose="Agent interfaces and artifact capture utilities",
        primary_stack="TypeScript/Python CLI + browser bridge tooling",
        scope_summary=(
            "Consolidate CLI, browser-terminal bridge, and screenshot/artifact "
            "capture into one tooling surface."
        ),
        first_milestone=(
            "Provide a unified command runner and artifact capture pipeline "
            "with clear upstream delta notes."
        ),
        owners="@edwardemoryphotography",
    ),
]


README_TEMPLATE = """# {repo_name}

> {purpose}

## Overview

{scope_summary}

## Project Status

- **Phase**: Standardization bootstrap
- **Primary stack**: {primary_stack}
- **First milestone**: {first_milestone}

## Repository Standards

This repository follows a mandatory baseline:
- `CHANGELOG.md` for version history
- `CONTRIBUTING.md` for contributor workflow
- `SECURITY.md` for vulnerability reporting
- `.github/workflows/repo-standards.yml` for baseline CI checks

## Quickstart

```bash
# clone and enter
git clone <repo-url>
cd {repo_name}
```

## Roadmap

- [ ] Finalize architecture and scope boundaries
- [ ] Deliver first end-to-end milestone
- [ ] Add automated tests for core path
- [ ] Add release workflow
"""


CHANGELOG_TEMPLATE = """# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

### Added
- Repository standardization baseline files and CI checks.

## [v0.1.0] - {today}

### Added
- Initial repository bootstrap for `{repo_name}`.
"""


CONTRIBUTING_TEMPLATE = """# Contributing

Thanks for contributing to `{repo_name}`.

## Branching

- Create a feature branch from `main`.
- Keep pull requests focused and small.
- Use descriptive commit messages.

## Pull Request Checklist

- [ ] Scope is clear and minimal
- [ ] Documentation updated (`README`/`CHANGELOG`) when needed
- [ ] Security implications reviewed
- [ ] CI checks pass

## Commit Message Style

Use concise prefixes:
- `feat:` new functionality
- `fix:` bug fix
- `docs:` documentation updates
- `chore:` maintenance work

## Development Expectations

- Prefer simple, maintainable code over premature abstraction.
- Add tests for behavior changes where feasible.
- Avoid introducing new dependencies without clear need.
"""


SECURITY_TEMPLATE = """# Security Policy

## Supported Versions

Security updates are applied to the latest active branch (`main`) unless stated otherwise.

## Reporting a Vulnerability

Please report vulnerabilities privately:
- Open a private security advisory if enabled, or
- Contact maintainers directly: {owners}

Include:
1. Affected area and impact
2. Reproduction steps
3. Suggested mitigation (if known)

## Response Targets

- Initial triage response: within 72 hours
- Mitigation plan: within 7 days (target)
"""


WORKFLOW_TEMPLATE = """name: Repo Standards

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  standards:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Verify required governance files
        run: |
          set -euo pipefail
          test -f README.md
          test -f CHANGELOG.md
          test -f CONTRIBUTING.md
          test -f SECURITY.md

      - name: Verify top-level markdown headers
        run: |
          set -euo pipefail
          for file in README.md CHANGELOG.md CONTRIBUTING.md SECURITY.md; do
            rg '^# ' "$file" >/dev/null
          done
"""


def render(template: str, target: TargetRepo) -> str:
    return template.format(
        repo_name=target.name,
        purpose=target.purpose,
        primary_stack=target.primary_stack,
        scope_summary=target.scope_summary,
        first_milestone=target.first_milestone,
        owners=target.owners,
        today=date.today().isoformat(),
    )


def write_file(path: Path, content: str, overwrite: bool) -> bool:
    if path.exists() and not overwrite:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")
    return True


def generate(output_dir: Path, overwrite: bool) -> None:
    created = 0
    skipped = 0

    for target in TARGETS:
        base = output_dir / target.name
        files = [
            (base / "README.md", render(README_TEMPLATE, target)),
            (base / "CHANGELOG.md", render(CHANGELOG_TEMPLATE, target)),
            (base / "CONTRIBUTING.md", render(CONTRIBUTING_TEMPLATE, target)),
            (base / "SECURITY.md", render(SECURITY_TEMPLATE, target)),
            (
                base / ".github/workflows/repo-standards.yml",
                render(WORKFLOW_TEMPLATE, target),
            ),
        ]

        for path, content in files:
            if write_file(path, content, overwrite=overwrite):
                created += 1
            else:
                skipped += 1

    print(f"Output directory: {output_dir}")
    print(f"Files written: {created}")
    print(f"Files skipped: {skipped}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate standard repo starter packs.")
    parser.add_argument(
        "--output-dir",
        default="repo-starters",
        help="Directory where starter packs will be generated",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing generated files",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    generate(output_dir=output_dir, overwrite=args.overwrite)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
