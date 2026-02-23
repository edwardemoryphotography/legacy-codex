#!/usr/bin/env bash
set -euo pipefail

# Self-improving agent — learning recorder
# Writes a structured JSON learning entry into the learnings/ directory.
# No network calls, no eval, no external dependencies.

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LEARNINGS_DIR="${SKILL_DIR}/learnings"

if [ $# -lt 1 ]; then
  echo "Usage: $0 \"<learning summary>\"" >&2
  exit 1
fi

SUMMARY="$1"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
SLUG="$(date -u +%Y%m%d-%H%M%S)"
OUTFILE="${LEARNINGS_DIR}/${SLUG}.json"

mkdir -p "${LEARNINGS_DIR}"

cat > "${OUTFILE}" <<ENTRY
{
  "timestamp": "${TIMESTAMP}",
  "source": "codex-manual-invocation",
  "summary": "${SUMMARY}",
  "context": {
    "repo": "legacy-codex",
    "branch": "$(git -C "${SKILL_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')",
    "commit": "$(git -C "${SKILL_DIR}" rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
  }
}
ENTRY

echo "Learning recorded: ${OUTFILE}"
