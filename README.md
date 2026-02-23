# Edward Emory Legacy Codex

> A distilled framework for how a neurodivergent, high-pattern-recognition mind partners with AI to build real-world outputs.

[![View Site](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen)](https://edwardemoryphotography.github.io/legacy-codex/)

---

## Overview

The **Legacy Codex** emerged from a breakthrough session on November 2–3, 2025. It is a living, structured framework for neurodivergent creators who operate in high-intensity hyperfocus bursts and need systems that adapt to their brain — not the other way around.

This repository contains the codex as a deployable GitHub Pages site with Netlify mirror support.

---

## Status

| Item | Status |
|------|--------|
| Active Development | ✅ Yes |
| Current Release | v18 |
| GitHub Pages | ✅ Live |
| Netlify Mirror | ✅ Active |
| Language | HTML |

---

## Current Release

- **Release: v18** (documentation and deployment visibility update)
- **Dashboard runtime: v17** (single-file operational dashboard in `index.html`)
- **Canonical release notes**: `CHANGELOG.md`

---

## What Is Inside

- **7-Phase Collaboration Protocol** — a step-by-step method for working with AI or collaborators, from initial assumption to meta-recognition.
- **Legacy Codex architecture** — a structure for preserving keystone principles, narratives, artifacts, and long-term continuity plans.
- **Transmission framework** — the four vehicles through which this work spreads (Narratives, People, Artifacts, Structures).
- **Continuity blueprint** — immediate and long-term actions to turn insight into repeatable practice.

---

## Framework Principles

1. **Build for your brain** — Systems should adapt to neurodivergent execution patterns, not force conformity
2. **High-pattern recognition** — Leverage rapid context-switching as a feature, not a bug
3. **AI as co-creator** — Partner with AI tools to extend executive function and working memory
4. **Transmit and preserve** — Document insights before the hyperfocus window closes
5. **Repeatable continuity** — Every breakthrough feeds back into the system

---

## View the Site

- **GitHub Pages**: https://edwardemoryphotography.github.io/legacy-codex/
- **Netlify Drop mirror**: publish from this repo and claim a persistent URL after deploy

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | HTML |
| Deployment | GitHub Pages |
| Mirror | Netlify Drop |
| Version Control | Git tags (v17, v18) |

---

## Getting Started

```bash
git clone https://github.com/edwardemoryphotography/legacy-codex.git
cd legacy-codex
# Open index.html in browser to view the dashboard
open index.html
```

---

## Skills

### self-improving-agent (v1.0.0)

A workspace-scoped skill that records structured learnings from Codex task
sessions.  Learnings are stored as timestamped JSON files inside
`skills/self-improving-agent/learnings/` and committed with normal git flow.

- **Invocation**: manual only — no auto-run hooks, no cron, no background
  processes.
- **Security**: no network access, no `eval`/`curl`/`wget`/`base64`; see
  `skills/self-improving-agent/SECURITY_REVIEW.md` for the full audit.
- **Usage**: `./skills/self-improving-agent/scripts/record-learning.sh "Your learning here"`

Added: 2026-02-23 via Safe Integration Plan v1.

---

## Roadmap

- [ ] v19: Interactive phase protocol UI
- [ ] Notion sync integration
- [ ] Mobile-optimized dashboard view
- [ ] Audio narration layer for accessibility
- [ ] Cross-link with codex-system-architecture
- [ ] Workshop export format (PDF/slides)

---

## Cross-Repo Consolidation Toolkit

Generated to reduce project fragmentation and preserve the strongest shipped features across related repos.

- **Live portfolio audit**: `reports/repo_portfolio_audit.md`
- **Machine-readable snapshot**: `reports/repo_portfolio_audit.json`
- **Robust target repo blueprint**: `reports/unified_repo_blueprint.md`
- **Phase 1 rollout checklist**: `reports/phase1_standardization_rollout.md`
- **Audit automation script**: `scripts/repo_portfolio_audit.py`
- **Starter-pack generator script**: `scripts/generate_repo_standards.py`
- **Phase 2 apply script**: `scripts/rollout_repo_standards.py`
- **Generated target starter packs**: `repo-starters/`
- **Phase 2 rollout report**: `reports/phase2_rollout_results.md`
- **Per-repo apply bundles**: `rollout-bundles/`

Starter packs now include full build-out scaffolding:
- governance docs
- CI baseline
- PR + issue templates
- docs architecture/decisions/runbooks/roadmap trees
- repo-specific module directories with ownership placeholders

Run the audit refresh at any time:

```bash
python3 scripts/repo_portfolio_audit.py --owner edwardemoryphotography --output-dir reports
```

Generate standardized target repo packs:

```bash
python3 scripts/generate_repo_standards.py --output-dir repo-starters --overwrite
```

Attempt direct cross-repo standards rollout (when token has write access):

```bash
python3 scripts/rollout_repo_standards.py --owner edwardemoryphotography --output-dir reports --bundle-dir rollout-bundles
```

---

## Related Repos

- [`codex-system-architecture`](https://github.com/edwardemoryphotography/codex-system-architecture) — Visual system architecture for Codex platform
- [`neurocreative-platform`](https://github.com/edwardemoryphotography/neurocreative-platform) — EEG + WHOOP integration
- [`muse-neurofeedback`](https://github.com/edwardemoryphotography/muse-neurofeedback) — Real-time brainwave neurofeedback

---

## Why This Update Matters

v18 establishes explicit changelog and deployment references so downstream AI agent runs can resolve the latest state without returning empty or stale results.

---

## Audit Notes

- **Last reviewed**: 2025 — Identified as stale-active during GitHub audit
- **Action taken**: README expanded with full framework documentation
- **Priority**: High — flagship neurodivergent execution framework

---

*Part of the edwardemoryphotography GitHub ecosystem.*
