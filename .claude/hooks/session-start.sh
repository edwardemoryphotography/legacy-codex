#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Installs dependencies in the current directory, preferring `npm ci` when a
# lockfile is present for reproducible, faster installs. No-ops if there is
# no package.json to install from.
install_deps() {
  if [ ! -f "package.json" ]; then
    return 0
  fi

  if [ -f "package-lock.json" ]; then
    npm ci --no-audit --no-fund
  else
    npm install --no-audit --no-fund
  fi
}

cd "$CLAUDE_PROJECT_DIR"
install_deps

if [ -f "foundry-console/package.json" ]; then
  cd foundry-console
  install_deps
fi
