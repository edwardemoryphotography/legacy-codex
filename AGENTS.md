# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Static single-page HTML dashboard ("Legacy Codex v17") with Python utility scripts. No build step, no npm dependencies, no backend services, no database.

### Running the app

Serve `index.html` with any static file server:

```bash
python3 -m http.server 8080 --directory /workspace
```

Then open `http://localhost:8080/index.html` in a browser. The two feature pages live at `/features/gemini-interface-v1.html` and `/features/knowledge-graph-v1.html`.

### Lint / CI checks

The CI workflow (`.github/workflows/repo-standards.yml`) runs three checks. Replicate locally with:

1. **Governance file presence**: `test -f README.md && test -f CHANGELOG.md && test -f CONTRIBUTING.md && test -f SECURITY.md`
2. **Python syntax**: `python3 -m py_compile scripts/repo_portfolio_audit.py scripts/generate_repo_standards.py scripts/rollout_repo_standards.py`
3. **Starter-pack smoke test**: `python3 scripts/generate_repo_standards.py --output-dir /tmp/repo-starters-smoke` then verify output files exist.

### Gotchas

- `package-lock.json` exists but is empty (no npm dependencies). Do not run `npm install`.
- The Artifact Analyzer feature in `index.html` calls the Google Gemini API client-side; it degrades gracefully without a valid API key.
- Python scripts require Python 3.12+ (standard library only, no pip dependencies).
