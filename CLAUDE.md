# Legacy Codex — Claude Setup Context

## Project State (as of 2026-05-18)

This repository contains:
- `index.html` — Legacy Codex v17 single-file dashboard (6 tabs, operational)
- `foundry-console/` — Next.js operations console with Supabase backend
- `scripts/` — Python repo management utilities

## Control Panel (primary deliverable)

The 7-tab Next.js dashboard has been built and pushed to:
**`edwardemoryphotography/codex-control-panel`** on branch `claude/run-project-setup-NLF9V`

Tabs:
1. **Overview** — 4 Canonical Principles + PASS/FAIL Validation Metrics (localStorage)
2. **Protocols** — 5 operational cards + Deployment Status + Open Deficits
3. **Sprint Linker** — task ↔ principle validation
4. **Resumption Log** — interruption-safe log generator with clipboard copy
5. **Biometrics** — real-data-only governor (WHOOP/Muse/Apple Health)
6. **Constraint Validator** — 4-principle codex check
7. **Codex** — 9-section knowledge graph (Root, Council, Territory, Artistic Systems, Neuro, Automation, Business, Personal OS, Convergence)

## Deployment

Vercel project: `prj_HxkvNkeYGEFDDjdkhd9yYdHCdPOf` is connected to `codex-control-panel`.
Merge the PR on `codex-control-panel` → auto-deploys to Vercel.

See `setup.sh` for the deployment checklist.

## Canonical Principles

1. **Artifact Anchoring** — Every interaction must yield a tangible system change or file.
2. **Interruption Resilience** — Systems must be stateless enough to survive pauses.
3. **Governing Law** — The system is the authority, not the user's fluctuating energy.
4. **Constraint Discipline** — Prefer modifying existing infrastructure over proposing new tools.

## Biometric Bridge

Write real metrics to `notes/biometric-trends.json`:
```json
[
  { "date": "2026-05-18", "sleepHours": 7.5, "recoveryScore": 78, "focusScore": 65 }
]
```
No mock data. The governor abstains rather than guesses.
