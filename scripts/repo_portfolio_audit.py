#!/usr/bin/env python3
"""Cross-repo portfolio audit for consolidation planning.

This script uses the authenticated GitHub CLI to:
1. Inventory repositories for an owner
2. Detect missing key governance/docs files
3. Extract current feature bullets from READMEs
4. Group overlapping repos by theme
5. Write JSON + Markdown outputs for consolidation decisions
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


KEY_DOCS = [
    "README",
    "LICENSE",
    "CHANGELOG",
    "CONTRIBUTING",
    "SECURITY",
    "WORKFLOWS",
]

THEME_KEYWORDS = {
    "eeg_neurofeedback": [
        "eeg",
        "muse",
        "neurofeedback",
        "brainwave",
        "whoop",
        "hrv",
    ],
    "codex_framework": [
        "codex",
        "legacy",
        "architecture",
        "protocol",
        "framework",
    ],
    "memory_intelligence": [
        "memory",
        "mem-layer",
        "retain",
        "knowledge base",
        "learn",
        "conversation",
        "mcp",
    ],
    "agent_tooling": [
        "cli",
        "agent",
        "terminal",
        "tool",
        "automation",
        "screenshot",
        "package manager",
    ],
}

THEME_DISPLAY = {
    "eeg_neurofeedback": "EEG + Neurofeedback",
    "codex_framework": "Codex + System Architecture",
    "memory_intelligence": "Memory + Knowledge Systems",
    "agent_tooling": "Agent Tooling + Interface Layer",
    "general": "General",
}

MANUAL_THEME_OVERRIDES = {
    "legacy-codex": "codex_framework",
    "codex-system-architecture": "codex_framework",
    "muse-neurofeedback": "eeg_neurofeedback",
    "museeegproject": "eeg_neurofeedback",
    "neurocreative-platform": "eeg_neurofeedback",
    "mem-layer": "memory_intelligence",
    "retain": "memory_intelligence",
    "gemini-cli": "agent_tooling",
    "opencode": "agent_tooling",
    "vibetunnel": "agent_tooling",
    "snag": "agent_tooling",
    "brew": "agent_tooling",
}


@dataclass
class RepoAudit:
    name: str
    url: str
    description: str
    default_branch: str
    primary_language: str
    is_archived: bool
    is_fork: bool
    updated_at: str
    root_items: list[str]
    key_docs: dict[str, bool]
    missing_key_docs: list[str]
    theme: str
    feature_bullets: list[str]


def run_cmd(cmd: list[str]) -> str:
    """Run command and return stdout."""
    proc = subprocess.run(
        cmd,
        text=True,
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        stderr = (proc.stderr or "").strip()
        stdout = (proc.stdout or "").strip()
        details = stderr or stdout or "unknown error"
        raise RuntimeError(f"Command failed ({' '.join(cmd)}): {details}")
    return proc.stdout


def gh_json(path: str) -> Any:
    return json.loads(run_cmd(["gh", "api", path]))


def gh_raw(path: str) -> str:
    return run_cmd(
        [
            "gh",
            "api",
            path,
            "-H",
            "Accept: application/vnd.github.raw",
        ]
    )


def safe_gh_json(path: str, fallback: Any) -> Any:
    try:
        return gh_json(path)
    except Exception:
        return fallback


def safe_gh_raw(path: str, fallback: str = "") -> str:
    try:
        return gh_raw(path)
    except Exception:
        return fallback


def detect_theme(name: str, description: str, readme_text: str) -> str:
    override_key = name.lower()
    if override_key in MANUAL_THEME_OVERRIDES:
        return MANUAL_THEME_OVERRIDES[override_key]

    corpus = f"{name} {description} {readme_text}".lower()
    scores: dict[str, int] = {}
    for theme, keywords in THEME_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            if keyword in corpus:
                score += 1
        scores[theme] = score

    best_theme = max(scores, key=scores.get)
    if scores[best_theme] == 0:
        return "general"
    return best_theme


def extract_feature_bullets(readme_text: str, limit: int = 10) -> list[str]:
    lines = readme_text.splitlines()
    headings = []
    for idx, line in enumerate(lines):
        if re.match(r"^##+\s+", line.strip()):
            headings.append((idx, line.strip().lower()))

    candidate_bullets: list[str] = []
    feature_heading_tokens = (
        "feature",
        "capabilit",
        "what is inside",
        "overview",
        "architecture",
        "highlights",
        "what it does",
        "key features",
    )

    for idx, heading in headings:
        if not any(token in heading for token in feature_heading_tokens):
            continue
        j = idx + 1
        while j < len(lines) and not re.match(r"^##+\s+", lines[j].strip()):
            raw = lines[j].strip()
            if re.match(r"^[-*]\s+", raw):
                bullet = re.sub(r"^[-*]\s+", "", raw).strip()
                if bullet.startswith("[ ]") or bullet.startswith("[x]"):
                    j += 1
                    continue
                candidate_bullets.append(clean_bullet(bullet))
            j += 1

    if not candidate_bullets:
        for line in lines:
            raw = line.strip()
            if re.match(r"^[-*]\s+", raw):
                bullet = re.sub(r"^[-*]\s+", "", raw).strip()
                if bullet.startswith("[ ]") or bullet.startswith("[x]"):
                    continue
                candidate_bullets.append(clean_bullet(bullet))

    deduped: list[str] = []
    seen: set[str] = set()
    for bullet in candidate_bullets:
        norm = normalize_text(bullet)
        if not norm or norm in seen:
            continue
        seen.add(norm)
        deduped.append(bullet)
        if len(deduped) >= limit:
            break
    return deduped


def clean_bullet(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_text(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def inspect_repo(owner: str, repo: dict[str, Any]) -> RepoAudit:
    name = repo["name"]
    description = repo.get("description") or ""
    branch = (repo.get("defaultBranchRef") or {}).get("name") or ""
    language = (repo.get("primaryLanguage") or {}).get("name") or ""
    root_contents = safe_gh_json(f"repos/{owner}/{name}/contents", fallback=[])
    root_items = sorted(
        [
            item.get("name")
            for item in root_contents
            if isinstance(item, dict) and item.get("name")
        ]
    )
    root_lower = [item.lower() for item in root_items]

    readme_raw = safe_gh_raw(f"repos/{owner}/{name}/readme", fallback="")
    features = extract_feature_bullets(readme_raw)

    has_workflows = False
    if ".github" in root_items:
        gh_sub = safe_gh_json(f"repos/{owner}/{name}/contents/.github", fallback=[])
        gh_items = {
            item.get("name")
            for item in gh_sub
            if isinstance(item, dict) and item.get("name")
        }
        has_workflows = "workflows" in gh_items

    key_docs = {
        "README": any(item.startswith("readme") for item in root_lower),
        "LICENSE": any(item.startswith("license") for item in root_lower),
        "CHANGELOG": any(item.startswith("changelog") for item in root_lower),
        "CONTRIBUTING": any(item.startswith("contributing") for item in root_lower),
        "SECURITY": any(item.startswith("security") for item in root_lower),
        "WORKFLOWS": has_workflows,
    }
    missing = [key for key in KEY_DOCS if not key_docs[key]]
    theme = detect_theme(name=name, description=description, readme_text=readme_raw)

    return RepoAudit(
        name=name,
        url=repo["url"],
        description=description,
        default_branch=branch,
        primary_language=language,
        is_archived=repo["isArchived"],
        is_fork=repo["isFork"],
        updated_at=repo["updatedAt"],
        root_items=root_items,
        key_docs=key_docs,
        missing_key_docs=missing,
        theme=theme,
        feature_bullets=features,
    )


def markdown_table(headers: list[str], rows: list[list[str]]) -> str:
    md = ["| " + " | ".join(headers) + " |", "| " + " | ".join(["---"] * len(headers)) + " |"]
    for row in rows:
        md.append("| " + " | ".join(row) + " |")
    return "\n".join(md)


def generate_markdown(
    owner: str,
    audits: list[RepoAudit],
    generated_at: str,
) -> str:
    active = [a for a in audits if not a.is_archived]
    active_non_fork = [a for a in active if not a.is_fork]

    inventory_rows: list[list[str]] = []
    for a in sorted(active, key=lambda item: (item.is_fork, item.name.lower())):
        status = "Fork" if a.is_fork else "Core"
        theme_label = THEME_DISPLAY.get(a.theme, THEME_DISPLAY["general"])
        inventory_rows.append(
            [
                a.name,
                status,
                a.primary_language or "-",
                theme_label,
                a.updated_at[:10],
            ]
        )

    key_doc_rows: list[list[str]] = []
    for a in sorted(active_non_fork, key=lambda item: item.name.lower()):
        missing = ", ".join(a.missing_key_docs) if a.missing_key_docs else "None"
        key_doc_rows.append(
            [
                a.name,
                "Yes" if a.key_docs["README"] else "No",
                "Yes" if a.key_docs["LICENSE"] else "No",
                "Yes" if a.key_docs["CHANGELOG"] else "No",
                "Yes" if a.key_docs["CONTRIBUTING"] else "No",
                "Yes" if a.key_docs["SECURITY"] else "No",
                "Yes" if a.key_docs["WORKFLOWS"] else "No",
                missing,
            ]
        )

    themed_groups: dict[str, list[RepoAudit]] = {}
    for a in active_non_fork:
        themed_groups.setdefault(a.theme, []).append(a)

    overlap_sections: list[str] = []
    for theme, repos in sorted(themed_groups.items()):
        if len(repos) < 2:
            continue
        theme_title = THEME_DISPLAY.get(theme, THEME_DISPLAY["general"])
        overlap_sections.append(f"### {theme_title}")
        overlap_sections.append(
            f"Potential overlap detected across **{len(repos)} repos**: "
            + ", ".join(f"`{repo.name}`" for repo in sorted(repos, key=lambda r: r.name.lower()))
            + "."
        )
        overlap_sections.append("")
        overlap_sections.append("Best currently-shipped features to preserve:")
        overlap_sections.append("")
        for repo in sorted(repos, key=lambda r: r.name.lower()):
            overlap_sections.append(f"- **{repo.name}**")
            if repo.feature_bullets:
                for bullet in repo.feature_bullets[:4]:
                    overlap_sections.append(f"  - {bullet}")
            else:
                overlap_sections.append("  - No feature bullets found in README; review manually.")
        overlap_sections.append("")

    migration_map = [
        (
            "codex-core",
            "legacy-codex + codex-system-architecture",
            [
                "Canonical protocol dashboard + execution governance",
                "Interactive architecture diagrams and dependency map",
                "Codex release/changelog discipline with visibility tooling",
            ],
        ),
        (
            "neurofeedback-stack",
            "muse-neurofeedback + neurocreative-platform + MuseEEGProject",
            [
                "Real-time Muse EEG ingestion and visualization",
                "Containerized runtime + CI/test harness from MuseEEGProject",
                "WHOOP correlation and adaptive neurodivergent state modeling",
            ],
        ),
        (
            "memory-intelligence",
            "mem-layer + retain",
            [
                "Persistent memory scopes and temporal knowledge tracking",
                "Conversation sync + searchable personal knowledge base",
                "Model-to-model note passing and learning extraction workflows",
            ],
        ),
        (
            "agent-tooling-hub",
            "gemini-cli + opencode + vibetunnel + snag",
            [
                "CLI and browser/terminal agent interfaces",
                "Capture and artifact-ingestion pipeline for prompts",
                "Unified docs for upstream fork purpose + custom delta tracking",
            ],
        ),
    ]

    migration_rows = []
    for target_repo, source_set, highlights in migration_map:
        migration_rows.append(
            [
                f"`{target_repo}`",
                source_set,
                "<br>".join(f"- {item}" for item in highlights),
            ]
        )

    core_missing_count = sum(1 for a in active_non_fork if a.missing_key_docs)
    active_count = len(active)
    core_count = len(active_non_fork)
    fork_count = len([a for a in active if a.is_fork])

    lines: list[str] = []
    lines.append("# Portfolio Audit and Consolidation Plan")
    lines.append("")
    lines.append(f"- **Owner**: `{owner}`")
    lines.append(f"- **Generated**: {generated_at}")
    lines.append(f"- **Active repos scanned**: {active_count} ({core_count} core + {fork_count} forks)")
    lines.append(
        f"- **Core repos missing at least one key governance doc**: {core_missing_count}/{core_count}"
    )
    lines.append("")
    lines.append("## 1) Active Repository Inventory")
    lines.append("")
    lines.append(markdown_table(["Repo", "Type", "Primary Lang", "Theme", "Updated"], inventory_rows))
    lines.append("")
    lines.append("## 2) Key File and Governance Coverage (Core Repos)")
    lines.append("")
    lines.append(
        markdown_table(
            [
                "Repo",
                "README",
                "LICENSE",
                "CHANGELOG",
                "CONTRIBUTING",
                "SECURITY",
                "WORKFLOWS",
                "Missing",
            ],
            key_doc_rows,
        )
    )
    lines.append("")
    lines.append("## 3) Redundancy and Overlap Clusters")
    lines.append("")
    if overlap_sections:
        lines.extend(overlap_sections)
    else:
        lines.append("No overlap clusters with 2+ core repos were detected.")
        lines.append("")
    lines.append("## 4) Consolidation Targets (Robust Repo Set)")
    lines.append("")
    lines.append(
        markdown_table(
            ["Target Repo", "Source Repos to Merge", "Best Features to Preserve"],
            migration_rows,
        )
    )
    lines.append("")
    lines.append("## 5) Action Sequence")
    lines.append("")
    lines.append("1. Create or designate the 4 target repos listed above.")
    lines.append("2. Move feature-complete code first (do not start with docs-only migration).")
    lines.append("3. Add missing governance docs in every core repo: `CHANGELOG`, `CONTRIBUTING`, `SECURITY`, CI workflows.")
    lines.append("4. Mark old overlapping repos as `legacy-*` or archive after migration checkpoints.")
    lines.append("5. Keep this audit script in CI (weekly) to prevent new fragmentation.")
    lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def serialize(audits: list[RepoAudit]) -> list[dict[str, Any]]:
    serialized = []
    for audit in audits:
        serialized.append(
            {
                "name": audit.name,
                "url": audit.url,
                "description": audit.description,
                "default_branch": audit.default_branch,
                "primary_language": audit.primary_language,
                "is_archived": audit.is_archived,
                "is_fork": audit.is_fork,
                "updated_at": audit.updated_at,
                "theme": audit.theme,
                "root_items": audit.root_items,
                "key_docs": audit.key_docs,
                "missing_key_docs": audit.missing_key_docs,
                "feature_bullets": audit.feature_bullets,
            }
        )
    return serialized


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit GitHub repos and generate consolidation report.")
    parser.add_argument("--owner", required=True, help="GitHub owner or organization name")
    parser.add_argument(
        "--output-dir",
        default="reports",
        help="Directory for generated JSON/Markdown outputs",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    repos = json.loads(
        run_cmd(
            [
                "gh",
                "repo",
                "list",
                args.owner,
                "--limit",
                "100",
                "--json",
                "name,isArchived,isFork,description,url,primaryLanguage,updatedAt,defaultBranchRef",
            ]
        )
    )

    audits = [inspect_repo(args.owner, repo) for repo in repos]
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    payload = {
        "owner": args.owner,
        "generated_at": generated_at,
        "repos": serialize(audits),
    }

    json_path = output_dir / "repo_portfolio_audit.json"
    md_path = output_dir / "repo_portfolio_audit.md"

    json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(generate_markdown(args.owner, audits, generated_at), encoding="utf-8")

    print(f"Wrote: {json_path}")
    print(f"Wrote: {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
