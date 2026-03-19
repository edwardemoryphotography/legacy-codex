# Edward Emory Legacy Codex

> A neurodivergent execution framework — and the infrastructure that runs it.

[![View Site](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen)](https://edwardemoryphotography.github.io/legacy-codex/)
[![Version](https://img.shields.io/badge/Release-v18-blue)](CHANGELOG.md)

---

## What This Is

The Legacy Codex is an execution framework built by and for a neurodivergent, high-pattern-recognition mind working in deep partnership with AI tools.

It emerged from a breakthrough session on November 2–3, 2025, and has been in active daily use since. The core insight: **most productivity systems are built for neurotypical execution patterns**. This one isn't.

The Codex is built around three realities:
- You see architecture before steps
- You work in hyperfocus bursts followed by recovery
- You lose context between sessions — so the system has to hold it for you

---

## What's In This Repo

| Directory / File | What it is |
|---|---|
| `index.html` | Live dashboard — the operational Codex UI (v17) |
| `foundry-console/` | Next.js console connected to Supabase — sprint tracking, friction log, milestones, audit log |
| `skills/self-improving-agent/` | Workspace-scoped skill that records structured learnings from Codex sessions |
| `scripts/` | Repo audit, standards rollout, and starter-pack generation tools |
| `features/` | Feature documentation |
| `CHANGELOG.md` | All version notes |
| `AGENTS.md` | Instructions for AI agents working in this repo |

---

## Core Framework Principles

1. **Build for your brain** — Systems adapt to you, not the reverse
2. **AI as co-creator** — Extend executive function and working memory with AI partners
3. **Transmit before the window closes** — Capture structure while hyperfocus is active
4. **No simulation** — Only real data, real metrics, real state. No inferred progress.
5. **Repeatable continuity** — Every session feeds back into the system

---

## Live Surfaces

| Surface | URL | Status |
|---|---|---|
| Codex Dashboard | [edwardemoryphotography.github.io/legacy-codex](https://edwardemoryphotography.github.io/legacy-codex/) | ✅ Live |
| Foundry Console | Deploy to Vercel from `foundry-console/` | Ready to deploy |

---

## The Foundry Console

The Foundry Console is a minimal Next.js web app that connects to a Supabase backend for structured sprint and workspace tracking.

**Stack:** Next.js App Router + TypeScript, Tailwind CSS, Supabase JS, Vercel

**To run locally:**
```bash
cd foundry-console
npm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

**Guarantees:**
- No mock data. Empty states only when data is absent.
- No service role key in frontend code.
- Supabase magic link auth only.

---

## Self-Improving Agent Skill

Records structured learnings from Codex task sessions as timestamped JSON.

```bash
./skills/self-improving-agent/scripts/record-learning.sh "Your learning here"
```

- Manual invocation only — no auto-run, no cron
- Learnings stored in `skills/self-improving-agent/learnings/`
- Full security audit: `skills/self-improving-agent/SECURITY_REVIEW.md`

---

## Repo Audit Toolkit

Tools for maintaining standards across the edwardemoryphotography GitHub ecosystem.

```bash
# Audit all repos
python3 scripts/repo_portfolio_audit.py --owner edwardemoryphotography --output-dir reports

# Generate standard starter packs
python3 scripts/generate_repo_standards.py --output-dir repo-starters --overwrite

# Roll out standards across repos
python3 scripts/rollout_repo_standards.py --owner edwardemoryphotography --output-dir reports --bundle-dir rollout-bundles
```

Reports live in `reports/`. Starter packs in `repo-starters/`. Apply bundles in `rollout-bundles/`.

---

## Related Repos

| Repo | Purpose |
|---|---|
| [codex-system-architecture](https://github.com/edwardemoryphotography/codex-system-architecture) | Visual system architecture for the Codex platform |
| [muse-neurofeedback](https://github.com/edwardemoryphotography/muse-neurofeedback) | Real-time EEG brainwave neurofeedback via Muse 2 + Mind Monitor OSC |
| [neurocreative-platform](https://github.com/edwardemoryphotography/neurocreative-platform) | EEG + WHOOP biometric integration |
| [Artful-Intelligence](https://github.com/edwardemoryphotography/Artful-Intelligence) | AI automation tools for neurodivergent creatives |
| [rork-legacy-codex-companion](https://github.com/edwardemoryphotography/rork-legacy-codex-companion) | Mobile companion app for Legacy Codex |

---

## Roadmap

- [ ] v19: Interactive phase protocol UI
- [ ] Notion sync integration
- [ ] Mobile-optimized dashboard view
- [ ] Foundry Console: Vercel deployment + live URL
- [ ] Workshop export format (PDF/slides)
- [ ] Audio narration layer for accessibility

---

*Built by [Edward Emory](https://edwardemory.com) — Santa Barbara, CA*
*Part of the edwardemoryphotography GitHub ecosystem*
