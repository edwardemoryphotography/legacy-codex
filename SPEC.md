# Legacy Codex — SPEC.md

**Version scope**: V37 baseline + V38 delta  
**Spec date**: 2026-05-30  
**Production truth**: https://legacy-codex.vercel.app  
**Status**: DRAFT — confirm before implementing V38 changes

---

## 1. Objective

Legacy Codex is a personal AI operating system that converts raw captures (voice notes, quick thoughts, task fragments) into clear, routed, executable next steps — reducing the cognitive overhead of managing work across multiple contexts.

**Target user**: One person (the owner). This is not a multi-tenant product.

**Core problem it solves**: Captures fragment across local files, GitHub, and Vercel unless there is a single routing layer that classifies them immediately and lands them in the right destination without requiring the user to decide where they belong.

**What "working correctly" looks like**:
- A raw voice note goes in → a routed action with destination comes out
- The task list reflects real biometric state (energy/focus) when data is available
- Production deployment state is knowable from the local workspace
- The Foundry Console shows sprint and friction state derived from agent output

---

## 2. Commands

| Command | Entry point | What it does |
|---|---|---|
| `npm run route` | `src/agents/routeOmega.ts` | Classifies a raw capture via Gemini, outputs route + next action |
| `npm run triage` | `src/agents/triage.ts` | Scans `notes/` for unclassified files → `TRIAGE_QUEUE.md` |
| `npm run distill` | `src/agents/distiller.ts` | Compresses session logs into a minimal resume-point nugget |
| `npm run rank` | `src/agents/taskRanker.ts` | Re-prioritises tasks using live WHOOP/Muse biometric scores |
| `npm run vercel-bridge` | `src/hooks/vercelBridge.ts` | Queries Vercel API for production deployment state |
| `npm run sync-hook` | `src/hooks/syncHook.ts` | Puppeteer screenshot of live app → Gemini vision diff |

**V38 additions needed**:
- `npm test` — must not exit 1. Minimum: smoke tests for routeOmega + distiller.
- `npm run check` — TypeScript compile check (`tsc --noEmit`) with zero errors.

---

## 3. Project Structure

```
src/
  agents/
    routeOmega.ts       # Capture dispatcher — reads input, calls Gemini, routes to lane
    triage.ts           # Scans notes/ for unclassified captures → TRIAGE_QUEUE.md
    distiller.ts        # Compresses session logs to minimal resume-point nugget
    taskRanker.ts       # Reorders tasks using WHOOP recovery + Muse focus scores
  hooks/
    vercelBridge.ts     # Queries Vercel API for production deployment + git meta
    syncHook.ts         # Puppeteer screenshot of live app → Gemini vision diff
  lib/
    gemini.ts           # Google Generative AI SDK wrapper (model selection, client init)
    biometrics.ts       # Real-data-only reader — fails gracefully if files absent/stale
    withRetry.ts        # Exponential backoff for Gemini/Vercel rate-limited calls
    fs.ts               # Protected file system — blocks writes to anchored files

foundry-console/        # Next.js 15 + Supabase dashboard
  src/app/              # Next.js App Router pages
  src/components/       # UI components
  src/lib/              # Supabase client, helpers
  SCHEMA.sql            # Authoritative DB schema (workspaces, sprints, friction_entries)

notes/                  # Session logs, decisions, triage queue, resume points
features/               # Feature specs and design notes
logs/                   # Execution traces, audit output
reports/                # Generated analysis
```

**Protected (never auto-modify)**:
- `index.html` — FREEZE SPEC
- `AGENTS.md` — agent behavioural rules
- `DELEGATION_RULES_v1.md` — routing source of truth
- `GEMINI.md` — Gemini-specific agent instructions

---

## 4. Code Style

| Rule | Detail |
|---|---|
| Runtime | Node.js ESM, `--experimental-strip-types` — no `ts-node` at runtime |
| Language | TypeScript 6 strict — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` enabled |
| Index access | Returns `T \| undefined` — always handle the undefined case |
| API calls | All Gemini and Vercel calls wrapped in `withRetry()` — no bare awaits |
| File writes | Route through `src/lib/fs.ts` — never bypass the protected-file guard |
| Diff size | Small diffs only — extend existing modules, never introduce parallel systems |
| State decisions | Must land in files (`notes/`, `SHIPPING_BLOCKER.txt`, spec files) — never rely on conversation memory |
| Status language | Concrete markers only: `BLOCKED`, `DONE`, `IN PROGRESS` |

---

## 5. Testing Strategy

### V37 Current State (gap)

`npm test` exits 1. There is no test runner configured. This is the largest quality risk.

### V38 Target

**Framework**: Vitest (compatible with ESM, zero config for TypeScript via `--experimental-strip-types`).

**Priority order**:

1. **routeOmega unit test** — mock `src/lib/gemini.ts`, assert routing JSON output shape is valid for known input fixtures. Does not require a real Gemini API key.
2. **distiller unit test** — given a sample session log file, assert output is non-empty and under a size threshold.
3. **biometrics unit test** — assert graceful degradation: when state file is absent, `taskRanker` logs a warning and returns the unranked list rather than throwing.
4. **vercelBridge smoke test** — when `VERCEL_TOKEN` is unset, assert the script exits with a clear human-readable error (not a stack trace).
5. **TypeScript compile check** — `tsc --noEmit` must pass with zero errors as a pre-commit gate.

**What is explicitly out of scope for tests**:
- Do not add mock or fixture biometric data to `notes/` or any tracked file
- Do not write tests that stub `fs.ts`'s protection layer (it should always be active)

---

## 6. Boundaries

These are hard constraints. They must not drift regardless of version.

| Boundary | Rule |
|---|---|
| `index.html` | FREEZE SPEC — never modify without an explicit written command from the user |
| `AGENTS.md`, `DELEGATION_RULES_v1.md`, `GEMINI.md` | Protected by `src/lib/fs.ts` — agent writes blocked automatically |
| Biometrics | Real data only. No mocks, no fixtures, no hardcoded scores. `taskRanker` must fail gracefully when data is absent. |
| `SHIPPING_BLOCKER.txt` | Exactly one sentence. Always replace — never append. |
| Scope | One blocker at a time. When stuck: stop, summarise in 2–4 lines, update the blocker, offer exactly 2 options. |
| Secrets | `.env.local` must never be committed. Any key from the previously-committed `.env.local` should be treated as compromised and rotated. |

---

## 7. V38 Delta — Known Gaps

These are the issues surfaced by the spec process. Address in priority order.

### P0 — Blocking ship

| Gap | Detail | Fix |
|---|---|---|
| Vercel API 403 | `vercelBridge` and `syncHook` both fail with 403 Forbidden — Vercel credentials are invalid or unset | Verify `VERCEL_TOKEN` has the correct scope and `VERCEL_PROJECT_ID` matches the linked project. Run `npm run vercel-bridge` to confirm. |
| `VERCEL_PRODUCTION_REF.md` empty | The workspace has no recorded link to what is actually live in production | Fill in branch + commit SHA once Vercel auth is working (see Option A or B in the file) |

### P1 — Quality risk

| Gap | Detail | Fix |
|---|---|---|
| No test suite | `npm test` exits 1 — zero automated verification | Add Vitest per testing strategy above, starting with routeOmega |
| TypeScript compile not gated | `tsc --noEmit` may have errors that are never surfaced | Add `npm run check` script; fix any type errors before V38 ships |

### P2 — Incomplete features

| Gap | Detail | Fix |
|---|---|---|
| foundry-console not wired | The Next.js dashboard schema (sprints, friction_entries) exists but no agent writes to it | Define one integration point first: `triage.ts` outputs to `friction_entries` table when `SUPABASE_URL` + `SUPABASE_ANON_KEY` are set |
| Biometrics pipeline fragile | `taskRanker` silently degrades — no log entry when biometric files are absent or stale | Add an explicit `console.warn` or note-file entry when falling back to unranked output, so the user knows why ranking didn't apply |

---

## 8. Acceptance Criteria for V38

V38 is shippable when:

- [ ] `npm run vercel-bridge` prints production deployment state without error
- [ ] `notes/VERCEL_PRODUCTION_REF.md` contains real branch + commit SHA
- [ ] `npm test` exits 0 with at least routeOmega and distiller covered
- [ ] `npm run check` (`tsc --noEmit`) exits 0
- [ ] `SHIPPING_BLOCKER.txt` is either empty or states a single remaining issue
- [ ] No secrets in any tracked file (verify with `git log --all -p | grep -i "api_key\|token\|secret"`)
