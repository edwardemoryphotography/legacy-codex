#!/usr/bin/env python3
"""Generate robust standardized starter packs for consolidation targets.

Each generated repository includes:
- Governance docs (`README`, `CHANGELOG`, `CONTRIBUTING`, `SECURITY`)
- CI baseline (`.github/workflows/repo-standards.yml`)
- PR + issue templates
- Structured docs tree
- Repo-specific module scaffolding
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


@dataclass(frozen=True)
class FileSpec:
    relative_path: str
    content: str
    executable: bool = False


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


REPO_MODULES: dict[str, list[tuple[str, str]]] = {
    "codex-core": [
        ("apps/dashboard/README.md", "Operational protocol dashboard application."),
        ("apps/architecture-view/README.md", "Interactive system architecture viewer."),
        ("docs/protocols/README.md", "Canonical operating protocols and enforcement guidance."),
        ("docs/integrations/README.md", "Cross-system integration contracts and interfaces."),
    ],
    "neurofeedback-stack": [
        ("backend/ingest/README.md", "Muse EEG signal ingestion services."),
        ("backend/signal/README.md", "Signal processing and feature extraction modules."),
        ("backend/api/README.md", "API endpoints and session orchestration layer."),
        ("frontend/dashboard/README.md", "Real-time visualization dashboard."),
        ("frontend/session-viewer/README.md", "Historical and live session explorer."),
        ("infra/docker/README.md", "Container definitions and local orchestration."),
        ("infra/workflows/README.md", "Deployment and operations workflow docs."),
        ("tests/integration/README.md", "Integration test scenarios."),
        ("tests/unit/README.md", "Unit test organization notes."),
    ],
    "memory-intelligence": [
        ("services/ingestion/README.md", "Conversation and artifact ingestion services."),
        ("services/indexing/README.md", "Index builders and memory normalization pipeline."),
        ("services/retrieval/README.md", "Retrieval and ranking services."),
        ("clients/cli/README.md", "CLI interface for memory operations."),
        ("clients/desktop/README.md", "Desktop application integration notes."),
        ("docs/memory-model/README.md", "Memory schema and scope design."),
        ("docs/retention-policies/README.md", "Retention, expiry, and governance policy."),
        ("docs/mcp/README.md", "MCP server/client integration details."),
    ],
    "agent-tooling-hub": [
        ("cli/README.md", "Terminal-native command surfaces for agents."),
        ("capture/README.md", "Artifact capture and preprocessing components."),
        ("bridge/README.md", "Browser-terminal bridge implementation notes."),
        ("docs/fork-deltas/README.md", "Upstream fork deltas and retained customizations."),
        ("docs/interface-contracts/README.md", "Shared contracts between tooling surfaces."),
        ("docs/command-recipes/README.md", "Operational command patterns and examples."),
    ],
}


README_TEMPLATE = """# {repo_name}

> {purpose}

## Overview

{scope_summary}

## Project Status

- **Phase**: build-out bootstrap
- **Primary stack**: {primary_stack}
- **First milestone**: {first_milestone}

## Repository Standards

This repository follows a mandatory baseline:
- `CHANGELOG.md` for version history
- `CONTRIBUTING.md` for contributor workflow
- `SECURITY.md` for vulnerability reporting
- `.github/workflows/repo-standards.yml` for baseline CI checks
- `.github/pull_request_template.md` and issue templates
- `docs/` tree for architecture, decisions, runbooks, and roadmap

## Quickstart

```bash
git clone <repo-url>
cd {repo_name}
./scripts/bootstrap.sh
```

## Initial Build-Out Checklist

- [ ] Confirm module ownership for each top-level folder
- [ ] Add first executable vertical slice
- [ ] Add test coverage for core behavior
- [ ] Wire release/version cadence
"""


CHANGELOG_TEMPLATE = """# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

### Added
- Repository governance baseline and scaffold structure.

## [v0.1.0] - {today}

### Added
- Initial build-out bootstrap for `{repo_name}`.
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
          test -f docs/roadmap.md
          test -f scripts/bootstrap.sh

      - name: Verify markdown headers
        run: |
          set -euo pipefail
          for file in README.md CHANGELOG.md CONTRIBUTING.md SECURITY.md docs/roadmap.md; do
            rg '^# ' "$file" >/dev/null
          done
"""


PR_TEMPLATE = """## Summary

<!-- What changed and why? -->

## Validation

- [ ] Tests added/updated (or N/A with reason)
- [ ] Docs updated (`README`, `CHANGELOG`, docs/)
- [ ] Security and risk review completed

## Checklist

- [ ] Scope is focused
- [ ] No secrets added
- [ ] CI passes
"""


BUG_TEMPLATE = """---
name: Bug report
about: Report incorrect behavior
title: "[BUG] "
labels: bug
assignees: ""
---

## Description

## Steps to Reproduce

1.
2.
3.

## Expected Behavior

## Actual Behavior

## Environment

- OS:
- Runtime version:
- Branch/commit:
"""


FEATURE_TEMPLATE = """---
name: Feature request
about: Suggest an enhancement
title: "[FEATURE] "
labels: enhancement
assignees: ""
---

## Problem

## Proposed Change

## Alternatives Considered

## Success Criteria

- [ ]
- [ ]
"""


ISSUE_CONFIG = """blank_issues_enabled: false
contact_links:
  - name: Security issue
    url: ./SECURITY.md
    about: Please report vulnerabilities privately using SECURITY.md guidance.
"""


DOCS_ARCHITECTURE = """# Architecture Notes

Use this directory for system diagrams, dependency boundaries, and interface contracts.
"""


DOCS_DECISIONS = """# Architecture Decision Records

Store design decisions in ADR format:

- Context
- Decision
- Consequences
"""


DOCS_RUNBOOKS = """# Runbooks

Operational procedures for bring-up, incident handling, and maintenance workflows.
"""


DOCS_ROADMAP = """# Roadmap

## Near Term

- [ ] Deliver first vertical slice
- [ ] Add baseline observability and health checks
- [ ] Publish implementation notes in docs/decisions

## Mid Term

- [ ] Harden CI with tests and lint checks
- [ ] Add release automation
"""


TESTS_README = """# Tests

Use this directory for repository test suites.

Recommended split:
- `unit/` for narrow logic tests
- `integration/` for cross-module behavior
"""


BOOTSTRAP_SCRIPT = """#!/usr/bin/env bash
set -euo pipefail

echo "Bootstrapping repository structure checks..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

required=(
  "README.md"
  "CHANGELOG.md"
  "CONTRIBUTING.md"
  "SECURITY.md"
  "docs/roadmap.md"
)

for file in "${required[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $file"
    exit 1
  fi
done

echo "Bootstrap checks complete."
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


def module_placeholder(path: str, summary: str) -> str:
    section_name = path.rsplit("/", 1)[0]
    return f"""# {section_name}

{summary}

## Initial Responsibilities

- Define module scope and boundaries
- Add first executable implementation task
- Document cross-module dependencies
"""


def common_files(target: TargetRepo) -> list[FileSpec]:
    return [
        FileSpec("README.md", render(README_TEMPLATE, target)),
        FileSpec("CHANGELOG.md", render(CHANGELOG_TEMPLATE, target)),
        FileSpec("CONTRIBUTING.md", render(CONTRIBUTING_TEMPLATE, target)),
        FileSpec("SECURITY.md", render(SECURITY_TEMPLATE, target)),
        FileSpec(".github/workflows/repo-standards.yml", render(WORKFLOW_TEMPLATE, target)),
        FileSpec(".github/pull_request_template.md", PR_TEMPLATE),
        FileSpec(".github/ISSUE_TEMPLATE/bug_report.md", BUG_TEMPLATE),
        FileSpec(".github/ISSUE_TEMPLATE/feature_request.md", FEATURE_TEMPLATE),
        FileSpec(".github/ISSUE_TEMPLATE/config.yml", ISSUE_CONFIG),
        FileSpec("docs/architecture/README.md", DOCS_ARCHITECTURE),
        FileSpec("docs/decisions/README.md", DOCS_DECISIONS),
        FileSpec("docs/runbooks/README.md", DOCS_RUNBOOKS),
        FileSpec("docs/roadmap.md", DOCS_ROADMAP),
        FileSpec("scripts/bootstrap.sh", BOOTSTRAP_SCRIPT, executable=True),
        FileSpec("tests/README.md", TESTS_README),
    ]


def repo_specific_files(target: TargetRepo) -> list[FileSpec]:
    modules = REPO_MODULES.get(target.name, [])
    return [FileSpec(path, module_placeholder(path, summary)) for path, summary in modules]


def write_file(path: Path, content: str, overwrite: bool, executable: bool) -> bool:
    if path.exists() and not overwrite:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")
    if executable:
        path.chmod(path.stat().st_mode | 0o111)
    return True


def write_manifest(output_dir: Path, targets: list[TargetRepo]) -> None:
    lines = [
        "# Repo Starter Packs",
        "",
        "This directory contains generated starter repositories for consolidation targets.",
        "",
        "## Generated Targets",
        "",
    ]
    for target in targets:
        lines.append(f"- `{target.name}`: {target.purpose}")
    lines.extend(
        [
            "",
            "## Regenerate",
            "",
            "```bash",
            "python3 scripts/generate_repo_standards.py --output-dir repo-starters --overwrite",
            "```",
            "",
        ]
    )
    (output_dir / "README.md").write_text("\n".join(lines), encoding="utf-8")


def generate(output_dir: Path, overwrite: bool) -> None:
    created = 0
    skipped = 0
    per_repo_counts: dict[str, int] = {}

    for target in TARGETS:
        base = output_dir / target.name
        specs = common_files(target) + repo_specific_files(target)
        per_repo_counts[target.name] = 0

        for spec in specs:
            path = base / spec.relative_path
            if write_file(
                path=path,
                content=spec.content,
                overwrite=overwrite,
                executable=spec.executable,
            ):
                created += 1
                per_repo_counts[target.name] += 1
            else:
                skipped += 1

    write_manifest(output_dir=output_dir, targets=TARGETS)

    print(f"Output directory: {output_dir}")
    print(f"Files written: {created}")
    print(f"Files skipped: {skipped}")
    for name, count in per_repo_counts.items():
        print(f"- {name}: {count} files updated")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate robust repo starter packs.")
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
