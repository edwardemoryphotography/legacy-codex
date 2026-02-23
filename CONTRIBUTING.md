# Contributing to Legacy Codex

Thanks for contributing to this repository.

## Scope

This repo is the consolidation control plane for:
- portfolio audits,
- cross-repo standardization,
- codex governance documentation.

Keep pull requests small, explicit, and artifact-focused.

## Branch and PR Guidelines

- Start from the default branch unless a task branch is provided.
- Use descriptive branch names tied to one objective.
- Open focused pull requests with a clear summary and validation notes.

## Commit Message Conventions

Use concise prefixes:
- `feat:` new functionality
- `fix:` bug fix
- `docs:` documentation updates
- `chore:` maintenance and refactors

Example:
```text
feat: add repo standardization starter generator
```

## Required Update Checklist

For behavioral or workflow changes, update:
- `README.md` (user-facing behavior/entrypoints),
- `CHANGELOG.md` (release history),
- related report files in `reports/` when audit outputs change.

## Validation

Before merging:
1. Run script syntax checks for Python automation.
2. Re-run portfolio audit if logic affecting reports changed.
3. Confirm required governance files still exist.

## Security and Secrets

- Never commit secrets or API keys.
- Use `.env` or secret managers outside version control.
- Follow `SECURITY.md` for vulnerability reporting process.
