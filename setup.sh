#!/bin/bash
# Legacy Codex v27 — Next.js setup and deploy script
# Run from the legacy-codex/ directory: bash setup.sh
# Requires: Node 18+, git, GitHub auth (gh or HTTPS)

set -e

echo ""
echo "⬡  Legacy Codex v27 — Next.js Setup"
echo "──────────────────────────────────────"
echo ""

# ── 1. Install dependencies ────────────────────────────────────
echo "→ Installing dependencies..."
npm install

# ── 2. Build verification ──────────────────────────────────────
echo "→ Building (type-check + compile)..."
npm run build

echo ""
echo "✓ Build passed."
echo ""

# ── 3. Git setup ───────────────────────────────────────────────
echo "→ Git setup..."

if [ ! -d ".git" ]; then
  git init
  git branch -M main
  echo "  Initialized new git repo."
fi

# Add remote if not present
if ! git remote get-url origin &>/dev/null 2>&1; then
  git remote add origin https://github.com/edwardemoryphotography/legacy-codex.git
  echo "  Added remote: origin"
fi

# ── 4. Commit and push ─────────────────────────────────────────
git add -A
git commit -m "feat: Next.js 14 migration — Legacy Codex v27

Full App Router rewrite from single-file HTML prototype.

- 7-tab dashboard (Overview, Protocols, Sprint, Resumption, Biometrics, Constraint Validator, Codex)
- Faithful port of v17 operational logic (principles, protocols, biometric governor)
- Biometric governor: real data only — no mock, fixture, sample, or fallback values
- Constraint Validator: all 4 canonical principles with pass/fail reasoning
- Artifact Analyzer: Gemini integration via NEXT_PUBLIC_GEMINI_API_KEY
- Codex tab: 9-section knowledge graph with markdown rendering
- localStorage persistence for metrics and deploy status
- TypeScript throughout, Tailwind CSS dark theme
- Mobile-first with bottom tab bar (desktop: top sticky)

Reality Filter Active. No mock data."

echo ""
echo "→ Pushing to origin/main..."
echo "   NOTE: This creates a NEW branch 'next-app' to avoid overwriting"
echo "   existing main. Merge via PR after review."
echo ""

# Push to a new branch so existing main is preserved
git push -u origin main:next-js-migration 2>/dev/null || git push -u origin HEAD:next-js-migration

echo ""
echo "✓ Pushed to: github.com/edwardemoryphotography/legacy-codex (branch: next-js-migration)"
echo ""
echo "─── Next steps ───────────────────────────────────────────"
echo ""
echo "1. Review the branch on GitHub:"
echo "   https://github.com/edwardemoryphotography/legacy-codex/tree/next-js-migration"
echo ""
echo "2. Open a PR → main (or merge directly if satisfied)"
echo ""
echo "3. Vercel will auto-deploy from main (it's already connected)"
echo "   Or add NEXT_PUBLIC_GEMINI_API_KEY in Vercel env vars for Artifact Analyzer"
echo ""
echo "4. Set environment variables in Vercel:"
echo "   NEXT_PUBLIC_GEMINI_API_KEY=your_key_here"
echo ""
