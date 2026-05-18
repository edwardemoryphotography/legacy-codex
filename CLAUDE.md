# legacy-codex — CLAUDE.md

Personal operating system for converting captures (voice notes, thoughts, tasks) into clear, executable next steps. Reduces cognitive overhead and prevents fragmentation across local files, GitHub, and Vercel production.

**Production truth**: `https://legacy-codex.vercel.app`

> For agent behavioral rules, specialist agent definitions, and operating protocols, see **`AGENTS.md`**.
> This file covers the technical codebase: structure, commands, conventions, and constraints for AI assistants.

---

## Critical Anchors (V37 — Never Drift)

Resolve all ambiguity toward these anchors, not toward memory, Notion, or other branches:

| Anchor | Rule |
|--------|------|
| **Production truth** | `https://legacy-codex.vercel.app` — treat as current external behavior unless explicitly verifying a preview or local build |
| **FREEZE SPEC** | Do **not** rewrite `index.html`, core JS, or core CSS unless the user explicitly types: `REWRITE THE APP CODE` |
| **Shipping blocker** | `SHIPPING_BLOCKER.txt` — exactly **one** concrete sentence; update when blocker changes; never leave stale |
| **Delegation routing** | `DELEGATION_RULES_v1.md` — classify captures and route to a single lane; never invent parallel routing schemes |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js (ES modules, `--experimental-strip-types`) |
| Language | TypeScript 6 (strict: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| AI | Google Generative AI SDK (`@google/generative-ai`) |
| Automation | Puppeteer (headless browser for Vercel screenshots) |
| Foundry Console | Next.js 15 + Supabase + Tailwind CSS (in `foundry-console/`) |

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values.

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | ✅ Yes | Google AI — used by all agent scripts |
| `VERCEL_TOKEN` | Optional | `vercelBridge.ts` — checks deployment state |
| `VERCEL_PROJECT_ID` | Optional | Identifies which Vercel project to query |
| `BIOMETRICS_STATE_FILE` | Optional | Path to live biometric state JSON (WHOOP/Muse) |
| `BIOMETRICS_TREND_FILE` | Optional | Path to biometric trends JSON |

> ⚠️ **Security note**: `.env.local` is accidentally tracked in git. Do **not** commit additional secrets to any tracked file. Use `.env.example` as the template.

---

## NPM Scripts

```bash
npm run route          # src/agents/routeOmega.ts — dispatch capture to correct lane via Gemini
npm run triage         # src/agents/triage.ts — scan notes/, write TRIAGE_QUEUE.md
npm run distill        # src/agents/distiller.ts — compress logs to session resume nuggets
npm run rank           # src/agents/taskRanker.ts — re-prioritize tasks using biometric data
npm run vercel-bridge  # src/hooks/vercelBridge.ts — verify production deployment state
npm run sync-hook      # src/hooks/syncHook.ts — screenshot live app + Gemini vision analysis
```

No test runner is configured (`npm test` exits 1). Run agents with `node` directly if needed.

---

## Project Structure

```
src/
  agents/
    routeOmega.ts       # Capture dispatcher: reads input, calls Gemini, routes to lane
    triage.ts           # Scans notes/ for unclassified captures → TRIAGE_QUEUE.md
    distiller.ts        # Compresses verbose session logs into restart nuggets
    taskRanker.ts       # Re-orders tasks using WHOOP/Muse biometric scores
  hooks/
    vercelBridge.ts     # Checks Vercel production state; optionally clears SHIPPING_BLOCKER.txt
    syncHook.ts         # Puppeteer screenshot of live app → Gemini vision diff
  lib/
    gemini.ts           # Google Generative AI SDK wrapper
    biometrics.ts       # Strict real-data-only biometric reader (no mocks allowed)
    withRetry.ts        # Exponential backoff for Gemini/Vercel rate-limited calls
    fs.ts               # Protected file system — blocks writes to anchored files

foundry-console/        # Next.js 15 + Supabase dashboard (sprints, milestones, friction logs)
features/               # Feature specs and design notes
skills/                 # Skill definitions
notes/                  # Session logs, decisions, resumption points (source of truth for session state)
logs/                   # Execution traces, audits, deployment notes
reports/                # Generated analysis reports
repo-starters/          # Starter templates
rollout-bundles/        # Release bundles
scripts/                # Utility scripts

index.html              # ⛔ FREEZE SPEC — do not modify without explicit command
AGENTS.md               # Agent behavioral rules — do not auto-modify
DELEGATION_RULES_v1.md # Routing logic — source of truth for capture-to-lane
SHIPPING_BLOCKER.txt    # Current blocker (one sentence max)
GEMINI.md              # Gemini-specific agent instructions
```

---

## Protected Files

`src/lib/fs.ts` blocks agent writes to the following files. Do **not** attempt to overwrite them without explicit user instruction:

- `AGENTS.md`
- `DELEGATION_RULES_v1.md`
- `GEMINI.md`
- `index.html` (FREEZE SPEC)

---

## Key Agents (src/agents/)

| Agent | Script | What it does |
|-------|--------|--------------|
| **routeOmega** | `routeOmega.ts` | Reads a raw capture, calls Gemini to classify it per `DELEGATION_RULES_v1.md`, outputs the routed lane + next action |
| **triage** | `triage.ts` | Scans `notes/` for unclassified files, summarizes into `TRIAGE_QUEUE.md` |
| **distiller** | `distiller.ts` | Reads session logs and compresses to a minimal "resume point" knowledge nugget |
| **taskRanker** | `taskRanker.ts` | Reads biometric state (WHOOP recovery + Muse focus scores) and reorders the active task list accordingly |

See `AGENTS.md` for behavioral rules, trigger phrases, and output formats for each agent.

---

## Biometrics Rules

`src/lib/biometrics.ts` enforces **real-data-only**:
- Never simulate or mock biometric data
- `taskRanker.ts` fails gracefully if `BIOMETRICS_STATE_FILE` does not exist or contains stale data
- Do not add fixture/test values to biometric files

---

## Coding Rules

1. **Small diffs only** — extend the current system; never introduce parallel systems.
2. **Decisions land in files** — if a decision matters, write it to `notes/`, `SHIPPING_BLOCKER.txt`, or a spec file. Never rely on conversation memory.
3. **Retry via `withRetry`** — all Gemini and Vercel API calls must use `src/lib/withRetry.ts` for exponential backoff.
4. **Explicit status markers** — use concrete language (`BLOCKED`, `DONE`, `IN PROGRESS`); never assume completion.
5. **One blocker at a time** — `SHIPPING_BLOCKER.txt` holds exactly one sentence. Update it; do not append.
6. **No branch archaeology during execution** — treat live deployment and current local files as reality unless doing explicit repo cleanup.
7. **TypeScript strict** — `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are enabled. Index access returns `T | undefined`; handle it.

---

## Session State

- Active session notes go in `notes/` with a dated filename (e.g., `notes/2025-05-18-session.md`).
- Use `npm run distill` at session end to compress the log into a minimal resume point.
- The `distiller` output is the starting context for the next session — keep it terse.

---

## When Stuck

1. Stop expanding scope.
2. Summarize the blocker in 2–4 lines.
3. Update `SHIPPING_BLOCKER.txt` with one sentence.
4. Offer exactly 2 options.
5. Recommend the lower-cognitive-load option first.

---

## Related Repos

| Repo | Role |
|------|------|
| [`codex-system-architecture`](https://github.com/edwardemoryphotography/codex-system-architecture) | Visual architecture/design layer for the Codex platform |
| `neurocreative-platform` | EEG + WHOOP biometric backend |
| `mem-layer` | AI memory/conversation aggregation |
