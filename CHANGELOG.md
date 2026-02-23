# Changelog

All notable changes to the Legacy Codex repository are documented in this file.

## [v20-phase1-standardization] - 2026-02-23

### Added
- `CONTRIBUTING.md` with branch, commit, and validation guidance.
- `SECURITY.md` with private vulnerability reporting expectations.
- `.github/workflows/repo-standards.yml` to enforce governance file presence and script syntax checks.
- `scripts/generate_repo_standards.py` to generate standardized starter packs for:
  - `codex-core`
  - `neurofeedback-stack`
  - `memory-intelligence`
  - `agent-tooling-hub`
- `repo-starters/` generated baseline governance + CI files for all four target repos.
- `reports/phase1_standardization_rollout.md` with rollout sequence and done criteria.

### Changed
- Expanded `README.md` consolidation toolkit with phase-1 rollout assets and generation commands.

## [v19-consolidation] - 2026-02-23

### Added
- `scripts/repo_portfolio_audit.py` to run live GitHub portfolio audits via `gh` CLI.
- `reports/repo_portfolio_audit.md` with active repo inventory, redundancy clusters, and key-file coverage.
- `reports/repo_portfolio_audit.json` machine-readable snapshot of repo health and extracted features.
- `reports/unified_repo_blueprint.md` defining a robust 4-repo consolidation architecture.

### Changed
- Updated `README.md` with a cross-repo consolidation toolkit section and rerun instructions.

## [v19-skill] - 2026-02-23

### Added
- `skills/self-improving-agent/` — workspace-scoped skill for recording structured learnings from Codex sessions.
- Skill metadata (`_meta.json`), configuration (`config.json`), documentation (`SKILL.md`), and security audit (`SECURITY_REVIEW.md`).
- `scripts/record-learning.sh` — manual-invocation script that writes timestamped JSON entries to `learnings/`.
- First learning entry created during integration test run.
- README section documenting the skill and its usage.
- Updated `Project_Structure_Final.md` with `skills/` directory.

### Security
- Full audit completed: no `curl`, `wget`, `eval`, `base64`, `python -c`, or network access.
- Least-privilege defaults enforced: no auto-run hooks, no cron, no background autonomy.

## [v18] - 2026-02-20

### Added
- Initial repository changelog to provide a machine-readable release trail for agent workflows.

### Changed
- Updated `README.md` with explicit release status, deployment links, and release-note location.
- Clarified that the operational dashboard remains v17 while v18 tracks documentation and release visibility improvements.

### Notes
- This release is focused on unblocking downstream automation that depends on current changelog metadata.
