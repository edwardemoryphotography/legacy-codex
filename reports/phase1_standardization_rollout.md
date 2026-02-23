# Phase 1 Standardization Rollout

This rollout converts the consolidation plan into immediate baseline hygiene across core repos.

## Current Gap Snapshot (Core Repos)

From `reports/repo_portfolio_audit.md`:

| Repo | Missing |
| --- | --- |
| `legacy-codex` | `CONTRIBUTING`, `SECURITY`, `WORKFLOWS` |
| `muse-neurofeedback` | `CHANGELOG`, `CONTRIBUTING`, `SECURITY`, `WORKFLOWS` |
| `MuseEEGProject` | `CHANGELOG`, `CONTRIBUTING`, `SECURITY` |
| `neurocreative-platform` | `CHANGELOG`, `CONTRIBUTING`, `SECURITY`, `WORKFLOWS` |
| `codex-system-architecture` | `CHANGELOG`, `CONTRIBUTING`, `SECURITY`, `WORKFLOWS` |

## Generated Starter Packs

Starter packs are generated in `repo-starters/`:

- `repo-starters/codex-core/`
- `repo-starters/neurofeedback-stack/`
- `repo-starters/memory-intelligence/`
- `repo-starters/agent-tooling-hub/`

Each pack contains:
- governance baseline:
  - `README.md`
  - `CHANGELOG.md`
  - `CONTRIBUTING.md`
  - `SECURITY.md`
  - `.github/workflows/repo-standards.yml`
- contribution templates:
  - `.github/pull_request_template.md`
  - `.github/ISSUE_TEMPLATE/*`
- build-out scaffolding:
  - `docs/architecture`, `docs/decisions`, `docs/runbooks`, `docs/roadmap.md`
  - `scripts/bootstrap.sh`
  - repo-specific module directories with `README.md` placeholders

## Regenerate Starter Packs

```bash
python3 scripts/generate_repo_standards.py --output-dir repo-starters --overwrite
```

## Apply to Existing Repos (Manual Procedure)

For each core repo:
1. Copy missing governance docs from the closest starter pack.
2. Adjust stack-specific quickstart and roadmap in README.
3. Add `.github/workflows/repo-standards.yml` when workflows are missing.
4. Commit and push with a docs/standards message.

Example commit message:
```text
docs: add baseline governance docs and standards workflow
```

## Done Criteria for Phase 1

- Every core repo has `README`, `CHANGELOG`, `CONTRIBUTING`, `SECURITY`.
- Every core repo has at least one CI workflow under `.github/workflows/`.
- No repo remains in "missing governance baseline" state on next audit run.
