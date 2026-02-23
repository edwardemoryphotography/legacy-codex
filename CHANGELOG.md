# Changelog

All notable changes to the Legacy Codex repository are documented in this file.

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
