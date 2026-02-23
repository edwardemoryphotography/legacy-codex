#!/usr/bin/env python3
"""Apply baseline governance standards across core repositories.

This script creates missing files (without overwriting existing ones):
- CHANGELOG.md
- CONTRIBUTING.md
- SECURITY.md
- .github/workflows/repo-standards.yml

It targets the core repositories identified in phase-1 rollout planning and
writes a local JSON + Markdown execution report.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import base64


@dataclass(frozen=True)
class RepoTarget:
    name: str
    purpose: str
    owners: str


TARGET_REPOS = [
    RepoTarget(
        name="muse-neurofeedback",
        purpose="Neurofeedback app for Muse EEG with real-time visualization.",
        owners="@edwardemoryphotography",
    ),
    RepoTarget(
        name="neurocreative-platform",
        purpose="Unified EEG + WHOOP creative execution platform.",
        owners="@edwardemoryphotography",
    ),
    RepoTarget(
        name="MuseEEGProject",
        purpose="Containerized EEG neurofeedback project with test/CI baseline.",
        owners="@edwardemoryphotography",
    ),
    RepoTarget(
        name="codex-system-architecture",
        purpose="Visual architecture map and system specification for the Codex platform.",
        owners="@edwardemoryphotography",
    ),
]


def run(cmd: list[str]) -> str:
    proc = subprocess.run(cmd, text=True, capture_output=True, check=False)
    if proc.returncode != 0:
        stderr = (proc.stderr or "").strip()
        stdout = (proc.stdout or "").strip()
        msg = stderr or stdout or "unknown error"
        raise RuntimeError(f"Command failed ({' '.join(cmd)}): {msg}")
    return proc.stdout


def run_ok(cmd: list[str]) -> tuple[bool, str]:
    proc = subprocess.run(cmd, text=True, capture_output=True, check=False)
    if proc.returncode == 0:
        return True, proc.stdout
    return False, proc.stderr or proc.stdout


def gh_json(path: str) -> Any:
    return json.loads(run(["gh", "api", path]))


def file_exists(owner: str, repo: str, path: str, branch: str) -> bool:
    ok, _ = run_ok(["gh", "api", f"repos/{owner}/{repo}/contents/{path}?ref={branch}"])
    return ok


def make_changelog(repo_name: str) -> str:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"""# Changelog

All notable changes to this project are documented in this file.

## [v0.1.0-standards] - {today}

### Added
- Baseline governance files for `{repo_name}`.
- Repository standards workflow under `.github/workflows/repo-standards.yml`.
"""


def make_contributing(repo_name: str) -> str:
    return f"""# Contributing

Thanks for contributing to `{repo_name}`.

## Pull Request Checklist

- [ ] Scope is clear and minimal
- [ ] Documentation updated as needed
- [ ] Security implications reviewed
- [ ] CI checks pass

## Commit Message Prefixes

- `feat:` new functionality
- `fix:` bug fix
- `docs:` documentation updates
- `chore:` maintenance tasks

## Working Style

- Prefer small, focused changes.
- Keep docs and changelog in sync with behavior changes.
- Avoid unnecessary dependencies.
"""


def make_security(repo_name: str, purpose: str, owners: str) -> str:
    return f"""# Security Policy

## Project Scope

`{repo_name}`: {purpose}

## Reporting a Vulnerability

Please report vulnerabilities privately:
- Use GitHub private security advisories if enabled, or
- Contact maintainers directly: {owners}

Include:
1. Affected area and potential impact
2. Reproduction steps
3. Suggested mitigation (if known)

## Response Targets

- Initial acknowledgment within 72 hours
- Mitigation plan within 7 days (target)
"""


def make_workflow() -> str:
    return """name: Repo Standards

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
"""


def build_file_payloads(target: RepoTarget) -> dict[str, str]:
    return {
        "CHANGELOG.md": make_changelog(target.name),
        "CONTRIBUTING.md": make_contributing(target.name),
        "SECURITY.md": make_security(target.name, target.purpose, target.owners),
        ".github/workflows/repo-standards.yml": make_workflow(),
    }


def create_file(
    owner: str,
    repo: str,
    branch: str,
    path: str,
    content: str,
    commit_message: str,
) -> dict[str, Any]:
    encoded = base64.b64encode(content.encode("utf-8")).decode("ascii")
    output = run(
        [
            "gh",
            "api",
            "--method",
            "PUT",
            f"repos/{owner}/{repo}/contents/{path}",
            "-f",
            f"message={commit_message}",
            "-f",
            f"content={encoded}",
            "-f",
            f"branch={branch}",
        ]
    )
    return json.loads(output)


def export_bundle(bundle_root: Path, target: RepoTarget, payloads: dict[str, str]) -> Path:
    repo_dir = bundle_root / target.name
    for rel_path, content in payloads.items():
        out_path = repo_dir / rel_path
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(content.rstrip() + "\n", encoding="utf-8")
    return repo_dir


def apply_repo(owner: str, target: RepoTarget, dry_run: bool) -> dict[str, Any]:
    repo_meta = gh_json(f"repos/{owner}/{target.name}")
    branch = repo_meta["default_branch"]
    payloads = build_file_payloads(target)
    commit_message = "docs: add baseline governance docs and standards workflow"

    created: list[dict[str, str]] = []
    skipped: list[str] = []
    errors: list[dict[str, str]] = []

    for path, content in payloads.items():
        if file_exists(owner=owner, repo=target.name, path=path, branch=branch):
            skipped.append(path)
            continue

        if dry_run:
            created.append({"path": path, "commit_sha": "(dry-run)", "commit_url": ""})
            continue

        try:
            result = create_file(
                owner=owner,
                repo=target.name,
                branch=branch,
                path=path,
                content=content,
                commit_message=commit_message,
            )
            commit = result.get("commit") or {}
            created.append(
                {
                    "path": path,
                    "commit_sha": commit.get("sha", ""),
                    "commit_url": commit.get("html_url", ""),
                }
            )
        except RuntimeError as exc:
            errors.append({"path": path, "error": str(exc)})

    return {
        "repo": target.name,
        "default_branch": branch,
        "created": created,
        "skipped_existing": skipped,
        "errors": errors,
        "planned_payloads": payloads,
    }


def to_markdown(
    owner: str,
    generated_at: str,
    dry_run: bool,
    repos: list[dict[str, Any]],
    bundle_dir: str,
) -> str:
    lines: list[str] = []
    lines.append("# Phase 2 Rollout Results")
    lines.append("")
    lines.append(f"- **Owner**: `{owner}`")
    lines.append(f"- **Generated**: {generated_at}")
    lines.append(f"- **Mode**: {'dry-run' if dry_run else 'apply'}")
    lines.append(f"- **Bundle export dir**: `{bundle_dir}`")
    lines.append("")

    for repo in repos:
        lines.append(f"## {repo['repo']}")
        lines.append("")
        lines.append(f"- Default branch: `{repo['default_branch']}`")
        lines.append(f"- Files created: **{len(repo['created'])}**")
        lines.append(f"- Existing skipped: **{len(repo['skipped_existing'])}**")
        lines.append(f"- Errors: **{len(repo['errors'])}**")
        lines.append("")

        if repo["created"]:
            lines.append("| Created File | Commit SHA | Commit URL |")
            lines.append("| --- | --- | --- |")
            for item in repo["created"]:
                url = item["commit_url"] or "-"
                lines.append(f"| `{item['path']}` | `{item['commit_sha'][:12]}` | {url} |")
            lines.append("")

        if repo["skipped_existing"]:
            lines.append("Skipped because file already exists:")
            for path in repo["skipped_existing"]:
                lines.append(f"- `{path}`")
            lines.append("")

        if repo["errors"]:
            lines.append("Create errors:")
            for err in repo["errors"]:
                lines.append(f"- `{err['path']}`: {err['error']}")
            lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Roll out baseline standards to core repos.")
    parser.add_argument("--owner", required=True, help="GitHub owner/org")
    parser.add_argument(
        "--output-dir",
        default="reports",
        help="Directory for rollout report outputs",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be created without writing changes",
    )
    parser.add_argument(
        "--bundle-dir",
        default="rollout-bundles",
        help="Directory for exported per-repo file bundles",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    bundle_dir = Path(args.bundle_dir)
    bundle_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for target in TARGET_REPOS:
        result = apply_repo(owner=args.owner, target=target, dry_run=args.dry_run)
        export_bundle(bundle_root=bundle_dir, target=target, payloads=result["planned_payloads"])
        # payload bodies are exported to bundle files; omit from JSON report
        del result["planned_payloads"]
        results.append(result)

    payload = {
        "owner": args.owner,
        "generated_at": generated_at,
        "dry_run": args.dry_run,
        "bundle_dir": str(bundle_dir),
        "repos": results,
    }

    json_path = output_dir / "phase2_rollout_results.json"
    md_path = output_dir / "phase2_rollout_results.md"
    json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(
        to_markdown(
            owner=args.owner,
            generated_at=generated_at,
            dry_run=args.dry_run,
            repos=results,
            bundle_dir=str(bundle_dir),
        ),
        encoding="utf-8",
    )

    print(f"Wrote: {json_path}")
    print(f"Wrote: {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
