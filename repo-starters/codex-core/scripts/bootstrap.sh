#!/usr/bin/env bash
set -euo pipefail

echo "Bootstrapping repository structure checks..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

required=(
  "README.md"
  "CHANGELOG.md"
  "CONTRIBUTING.md"
  "SECURITY.md"
  "docs/roadmap.md"
)

for file in "${required[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $file"
    exit 1
  fi
done

echo "Bootstrap checks complete."
