# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal operating system for converting captures (voice notes, thoughts, tasks) into clear, executable next steps. Reduces cognitive overhead and prevents fragmentation across local files, GitHub, and Vercel production.

**Production truth**: `https://legacy-codex.vercel.app`

> For agent behavioral rules, specialist agent definitions, and operating protocols, see **`AGENTS.md`**.
> This file covers the technical codebase: structure, commands, conventions, and constraints for AI assistants.

---

## Critical Anchors (V37 — Never Drift)

Refer to `AGENTS.md` for the authoritative list of V37 anchors (Production truth, FREEZE SPEC, Shipping blocker, and Delegation routing). AI assistants must resolve all ambiguity toward the definitions in that file, not toward memory or other branches.

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

Copy `.env.example` to `.env` and fill in values.

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | ✅ Yes | Google AI — used by all agent scripts |
| `VERCEL_TOKEN` | Optional | `vercelBridge.ts` — checks deployment state |
| `VERCEL_PROJECT_ID` | Optional | Identifies which Vercel project to query |
| `BIOMETRICS_STATE_FILE` | Optional | Path to live biometric state JSON (WHOOP/Muse) |
| `BIOMETRICS_TREND_FILE` | Optional | Path to biometric trends JSON |

---

## Commands

### Root agents

```bash
npm run route "[VOICE-SYNC] <capture text>"   # Dispatch capture to correct lane via Gemini
npm run triage         # Scan notes/, write TRIAGE_QUEUE.md
npm run distill        # Compress session logs to resume nuggets
npm run rank           # Re-prioritize tasks using biometric data
npm run vercel-bridge  # Verify production deployment state
npm run sync-hook      # Puppeteer screenshot of live app + Gemini vision diff
```

Run a single agent directly (no npm script needed):
```bash
node --no-warnings --experimental-strip-types src/agents/triage.ts
```

There is no build step — TypeScript is run directly via `--experimental-strip-types`. There is no `tsc` compile. Type errors surface at runtime unless you run `npx tsc --noEmit` manually.

```bash
npx tsc --noEmit    # Type-check without emitting files
```

### Foundry Console (`foundry-console/`)

```bash
cd foundry-console
npm install
npm run dev     # Next.js dev server
npm run build   # Production build
npm run lint    # ESLint via next lint
```

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
    gemini.ts           # Google Generative AI SDK wrapper (defaults to gemini-2.5-pro)
    biometrics.ts       # Strict real-data-only biometric reader (no mocks allowed)
    biometricTrends.ts  # 7-day trend aggregator; summarizeTrend() computes projectMode
    withRetry.ts        # Exponential backoff for Gemini/Vercel rate-limited calls
    fs.ts               # Protected file system — blocks writes to anchored files

foundry-console/        # Next.js 15 + Supabase dashboard (sprints, milestones, friction logs)
notes/                  # Session logs, decisions, resumption points (source of truth for session state)
logs/                   # Execution traces, audits, deployment notes

index.html              # ⛔ FREEZE SPEC — do not modify without explicit command
AGENTS.md               # Agent behavioral rules — do not auto-modify
DELEGATION_RULES_v1.md  # Routing logic — source of truth for capture-to-lane
SHIPPING_BLOCKER.txt    # Current blocker (one sentence max)
GEMINI.md               # Gemini-specific agent instructions
```

---

## Protected Files

`src/lib/fs.ts` blocks agent writes to the following files at runtime. Do **not** attempt to overwrite them without explicit user instruction:

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

`src/lib/biometrics.ts` and `src/lib/biometricTrends.ts` enforce **real-data-only**:
- Never simulate or mock biometric data in the actual state/trend files
- `taskRanker.ts` refuses to rank and exits if biometric data is unavailable or stale
- `biometricTrends.ts` exposes `summarizeTrend(days)` — a pure function that computes `projectMode` (`deep_build`, `creative_edit`, `admin_light`, `recovery`) and `readinessScore` from the last 7 days of data

---

## Test Coverage

No test runner is configured (`npm test` exits 1). The following modules contain pure functions that are fully testable without network or file I/O and are the highest-priority candidates if tests are added:

| Module | Testable surface | Why |
|--------|-----------------|-----|
| `src/lib/biometricTrends.ts` | `summarizeTrend()`, `isTrendPoint()`, `clamp()`, `average()` | Pure functions with complex branching logic; `summarizeTrend` determines `projectMode` thresholds that affect task routing |
| `src/lib/withRetry.ts` | `isRetryableCapacityError()`, `withRetry()` retry count/backoff | Error classification logic covers 6 distinct conditions; retry sequencing is hard to verify manually |
| `src/lib/fs.ts` | `safeWriteFile()` / `safeAppendFile()` protection | Protected-file enforcement is a safety invariant — a regression here would allow overwriting `AGENTS.md` |

Recommended runner: `node:test` (built-in, no extra deps) or `vitest` (ESM-native, compatible with this project's `"type": "module"` setup). Tests for biometric pure functions **may** use synthetic fixture values — the real-data-only rule applies only to the live state/trend JSON files, not to unit test inputs.

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
