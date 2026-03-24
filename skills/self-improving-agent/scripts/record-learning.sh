#!/usr/bin/env bash
set -euo pipefail

learning="${1:-}"
if [[ -z "$learning" ]]; then
  echo "Usage: $0 \"Your learning here\"" >&2
  exit 1
fi

# Repo root = skills/self-improving-agent/scripts -> ../../../
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
log="${root}/notes/LEARNINGS_LOG.md"

mkdir -p "$(dirname "$log")"
if [[ ! -f "$log" ]]; then
  printf '%s\n\n' "# Learnings log" >"$log"
fi

{
  printf '\n## %s\n\n' "$(date '+%Y-%m-%d %H:%M')"
  printf '%s\n' "$learning"
} >>"$log"

echo "Recorded learning → ${log}"
