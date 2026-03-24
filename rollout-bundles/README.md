# Rollout Bundles

This directory contains prebuilt governance + CI files for phase-2 cross-repo standardization.

## Target Repos

- `muse-neurofeedback`
- `neurocreative-platform`
- `MuseEEGProject`
- `codex-system-architecture`

Each repo folder includes:
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `.github/workflows/repo-standards.yml`

## Apply Procedure

From inside each target repository:

```bash
cp -R /path/to/rollout-bundles/<repo-name>/. .
git add .
git commit -m "docs: add baseline governance docs and standards workflow"
git push
```

If `.github/workflows` does not exist, create it before copying workflow files.
