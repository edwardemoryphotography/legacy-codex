#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
npm install --no-audit --no-fund

if [ -f "foundry-console/package.json" ]; then
  cd foundry-console
  npm install --no-audit --no-fund
fi
