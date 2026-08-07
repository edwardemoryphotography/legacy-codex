# Legacy Codex — Project Status

> **Single source of truth for all agents.** Read this before starting any work.
> **Canonical repo:** `~/legacy-codex` (Next.js 16.3, main branch)
> **Remote:** `https://github.com/edwardemoryphotography/legacy-codex`

---

## 🎯 Current Mission

Turn Legacy Codex from a polished local dashboard into an **operational private studio OS** with deep linking, operator controls, persisted workspace snapshots, codex bookmarking/search improvements, resumable logs, and useful biometric/task workflows.

---

## 📁 Canonical Checkout

| Path | Purpose | Next.js |
|------|---------|---------|
| `~/legacy-codex` | **✅ PRIMARY** — All PR work, builds, deployments | 16.3 |
| `~/workspace/legacy-codex` | ⚠️ Stale (Next.js 14.2.5) — do not use for new work | 14.2.5 |

**Rule:** Always work in `~/legacy-codex`. The workspace checkout is legacy-only.

---

## 🔀 Active Pull Requests

| PR | Lane | Branch | Author | Status | Mergeable | Dependencies |
|---|---|---|---|---|---|---|
| **#49** | B — Foundry UI | `cursor/autonomous-project-hygiene-foundry-ui-4e59` | Cursor/Codex | 🟡 OPEN | **CLEAN** (needs branch update) | #47 ✅ |
| **#37** | Mission Loop | `claude/superpowers-mission-loop-iuuozw` | Claude Code | 🟡 OPEN | UNSTABLE | None |

### PR #47 — ✅ MERGED (2026-08-07)
- ~~Adds~~ **Added** `routed_requests` + `evidence_items` tables
- Append-only correction chain (`supersedes_request_id`)
- RLS: owner-email-only, `anon` fully revoked
- Migration **applied to production** (`pkydkbuodikttfeawqsw`)
- Verification: 33/33 tests passing, tsc clean, build clean
- **Live DB checks: DONE** — RLS verified working

### PR #49 — Foundry Routing UI (Ready to merge)
- `/dashboard/routing` inbox + detail views
- `deriveFoundryState()` cognitive summary (never stored)
- Evidence states: pending / verified / unverified / conflict / stale
- **Merge status:** Local merge with main succeeded cleanly — no conflicts
- **Action needed:** Update branch head on GitHub (rebase or merge main into PR branch)

| PR | Lane | Branch | Author | Status | Mergeable | Dependencies |
|---|---|---|---|---|---|---|
| **#47** | A — Foundation | `claude/autonomous-project-hygiene-foundation` | Claude Code | 🟡 OPEN | UNSTABLE | None |
| **#49** | B — Foundry UI | `cursor/autonomous-project-hygiene-foundry-ui-4e59` | Cursor/Codex | 🟠 DRAFT | CLEAN | #47 |
| **#37** | Mission Loop | `claude/superpowers-mission-loop-iuuozw` | Claude Code | 🟡 OPEN | UNSTABLE | None |

### PR #47 — Routing Control Plane Foundation
- Adds `routed_requests` + `evidence_items` tables
- Append-only correction chain (`supersedes_request_id`)
- RLS: owner-email-only, `anon` fully revoked
- Migration forward-only, **not yet applied to production**
- Verification: 33/33 tests passing, tsc clean, build clean
- **Live DB checks: PENDING** (needs owner session)

### PR #49 — Foundry Routing UI
- `/dashboard/routing` inbox + detail views
- `deriveFoundryState()` cognitive summary (never stored)
- Evidence states: pending / verified / unverified / conflict / stale
- **Draft — do not merge until #47 lands**

### PR #37 — Mission Loop
- Data model, lifecycle logic, evidence bridge
- **Blocked:** needs rework — tables would parallel `actions`/`events`/`evidence_items`

---

## 🛤️ Lane C Recovery Worktrees

Codex has verified candidates in isolated worktrees:

| Worktree | Branch | Commit | Status |
|---|---|---|---|
| `~/Documents/Codex/.../legacy-pr47` | `lane-c/recovery-task1-legacy-pr47` | `30ec9c0` | ✅ Verified |
| `~/Documents/Codex/.../legacy-pr49` | `lane-c/recovery-task1-legacy-pr49` | `8117d95` | ✅ Verified |

These are **disposable verification sandboxes**. Changes should be reconciled back to the branch heads in `~/legacy-codex`, not committed from the worktrees.

---

## 📋 Rescue Plan (Hermes)

File: `~/legacy-codex/.hermes/plans/legacy-codex-rescue.md`

1. **Workspace deep-linking + command palette** — `?tab=` / `#tab=` URL sync, Cmd/Ctrl+K palette
2. **Resumption + workspace state persistence** — localStorage history, snapshot export
3. **Codex knowledge graph upgrades** — bookmarks, recent entries, tag filtering, copy-link
4. **Sprint / constraint workflows** — checklist generation, improved file analysis guidance
5. **Biometric / operator polish** — refresh status, empty-state honesty, summary badges
6. **Final verification + cleanup** — build, browser smoke test, commit

---

## 🤖 Agent Assignments

### Hermes
- **Current:** Idle (home directory, cron jobs only)
- **Target:** `~/legacy-codex`
- **Action:** Start a session in `~/legacy-codex` and execute the rescue plan tasks
- **Config:** `~/.hermes/profiles/default/config.yaml` (set `cwd: ~/legacy-codex`)

### Claude Code
- **Current:** Idle (home directory, recently ran `/doctor`, `/login`)
- **Target:** `~/legacy-codex`
- **Action:** `claude ~/legacy-codex` or within session: `/cwd ~/legacy-codex`
- **Focus:** PR #49 merge prep — verify the branch merges cleanly, update PR if needed

### Codex
- **Current:** Deep in Lane C verification (`~/Documents/Codex/...` worktrees)
- **Target:** Reconcile back to `~/legacy-codex` branches
- **Action:** Switch to `~/legacy-codex`, work on PR #49 (now unblocked since #47 merged)
- **Focus:** Complete PR #49 — update branch with main, final verification, ready for merge
- **Current:** Idle (home directory, recently ran `/doctor`, `/login`)
- **Target:** `~/legacy-codex`
- **Action:** `claude ~/legacy-codex` or within session: `/cwd ~/legacy-codex`
- **Focus:** PR #47 completion — apply migration, run live DB checks, resolve contradictions

### Codex
- **Current:** Deep in Lane C verification (`~/Documents/Codex/...` worktrees)
- **Target:** Reconcile back to `~/legacy-codex` branches
- **Action:** Switch to `~/legacy-codex`, use `lane-c/recovery-task1-legacy-pr47` and `lane-c/recovery-task1-legacy-pr49`
- **Focus:** Complete PR #49 once #47 merges

---

## 🏗️ Architecture Notes

- **Tab system:** `src/components/CodexApp.tsx` owns `activeTab`. 9 tabs total (including new Consolidation).
- **Type source:** `src/types/index.ts` — define shapes here first.
- **Styling:** CSS custom properties in `src/app/globals.css`, Tailwind aliases in `tailwind.config.ts`.
- **State:** `useLocalStorage` hook for SSR-safe persistence.
- **Supabase:** Separate project (`pkydkbuodikttfeawqsw`) — **not** shared with `codex-system-architecture`.
- **Claude API:** `src/app/api/analyze/route.ts` — server-side only, `ANTHROPIC_API_KEY`.
- **Deploy:** Vercel required (has `/api/analyze` server route). Not a static export.

---

## ✅ Build Verification

```bash
cd ~/legacy-codex
npm run build    # Next.js 16.3, Turbopack
npm run lint     # ESLint
npx tsc --noEmit # Type check
```

Last verified: **2026-08-06** — Build passing with ConsolidationTab + BiometricsTab refactor.

---

## 🚧 Blockers

1. ~~**PR #47** needs owner session to apply migration + verify RLS~~ ✅ **RESOLVED** — migration applied, RLS verified
2. **PR #37** needs rework — conflicts with existing `actions`/`events` tables
3. **PR #49** needs branch updated on GitHub (merge main into PR branch — clean locally, just out of date)
4. **Hermes** needs to be pointed at `~/legacy-codex` (currently in home dir)
5. **Claude Code** needs to be pointed at `~/legacy-codex` (currently in home dir)

1. **PR #47** needs owner session to apply migration + verify RLS against non-owner
2. **PR #37** needs rework — conflicts with existing `actions`/`events` tables
3. **PR #49** is draft until #47 merges
4. **Hermes** needs to be pointed at `~/legacy-codex` (currently in home dir)
5. **Claude Code** needs to be pointed at `~/legacy-codex` (currently in home dir)

---

## 📝 Changelog

| Date | Change |
|---|---|
| 2026-08-07 | PR #47 **MERGED** — routing control plane foundation live on main |
| 2026-08-07 | PR #49 verified: merges cleanly with main (no conflicts) |
| 2026-08-07 | Supabase migration applied + RLS verified on production DB |
| 2026-08-06 | Ported ConsolidationTab from `~/workspace/legacy-codex` to canonical repo |
| 2026-08-06 | Ported BiometricsTab refactor (extracted `@/lib/biometrics`) |
| 2026-08-05 | Codex completed Lane C Task 2A verification (builds, tests, SQL, security matrix) |
|---|---|
| 2026-08-06 | Ported ConsolidationTab from `~/workspace/legacy-codex` to canonical repo |
| 2026-08-06 | Ported BiometricsTab refactor (extracted `@/lib/biometrics`) |
| 2026-08-05 | Codex completed Lane C Task 2A verification (builds, tests, SQL, security matrix) |
| 2026-08-04 | Codex started Lane C recovery worktree verification |
| 2026-07-30 | PR #47 opened (Claude Code) — routing control plane foundation |
| 2026-07-30 | PR #49 opened (Cursor/Codex) — Foundry routing UI |
