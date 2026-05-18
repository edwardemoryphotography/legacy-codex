#!/usr/bin/env bash
# setup.sh — Legacy Codex project setup
# This script documents the manual setup steps that are now automated
# via the GitHub → Vercel integration on codex-control-panel.
#
# Vercel project: prj_HxkvNkeYGEFDDjdkhd9yYdHCdPOf
# Connected repo: edwardemoryphotography/codex-control-panel
#
# Status: AUTOMATED — pushing to main on codex-control-panel triggers deploy.
# Run this script only if you need to manually re-link the Vercel project.

set -e

echo "Legacy Codex Setup"
echo "=================="
echo ""
echo "Vercel project ID: prj_HxkvNkeYGEFDDjdkhd9yYdHCdPOf"
echo "GitHub repo (control panel): edwardemoryphotography/codex-control-panel"
echo "GitHub repo (codex): edwardemoryphotography/legacy-codex"
echo ""
echo "To deploy:"
echo "  1. Merge the PR from branch claude/run-project-setup-NLF9V"
echo "     in codex-control-panel to main."
echo "  2. Vercel auto-deploys on push to main."
echo "  3. The 7-tab Legacy Codex v17 dashboard will be live."
echo ""
echo "To re-link Vercel manually (if needed):"
echo "  vercel link --project prj_HxkvNkeYGEFDDjdkhd9yYdHCdPOf"
echo "  vercel env pull .env.local"
echo ""
echo "Dashboard tabs: Overview | Protocols | Sprint Linker | Resumption Log"
echo "                Biometrics | Constraint Validator | Codex"
echo ""
echo "Biometric bridge: write real data to notes/biometric-trends.json"
echo "Format: [{date, sleepHours, recoveryScore, focusScore}]"
echo ""
echo "Done."
