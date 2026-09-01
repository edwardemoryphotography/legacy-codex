# STATE.md — legacy-codex (local pointer)

**Canonical cross-project state lives in `codex-control-panel/STATE.md`** (Master Charter §8, Standards Kit 2.1.0) — read that first for shipped / blocked / next / active governance rules / stack & keys reference / canonical repo locations.

This file used to keep its own independent copy of that same content. It drifted: this repo's copy was still dated 2026-06-15 while `codex-control-panel`'s was newer, and both were missing entries the other had. As of 2026-08-10, everything real from this file's copy — including the two entries below that only existed here — has been merged into the hub's canonical copy, and this file is now a pointer plus genuinely repo-local notes only.

## Repo-local notes

- **FREEZE SPEC**: don't rewrite `src/app/` (`page.tsx`, `layout.tsx`, `globals.css`, `api/`), `src/components/`, `src/lib/`, or `src/hooks/` unless Eddie explicitly says "REWRITE THE APP CODE". Docs, config, and coordination files (including this one) are not frozen. **Corrected 2026-08-10, Eddie-approved:** this rule previously cited `app/index.html`, which does not exist in this repo (Next.js App Router; real entry is `src/app/page.tsx`) — the freeze was guarding a phantom path while the actual app code sat unprotected. **Do not restore the old `app/index.html` wording.**
- **LESSONS** — durable, *repo-specific* improvement notes (not cross-project — those go in the hub's `STATE.md`). Add an entry only when a lesson is likely to help a future session working in this repo specifically.
  - **2026-09-01 — The Mission Loop tables are empty in production.** `missions`, `mission_events`, and `evidence_snapshots` all had 0 rows in project `pkydkbuodikttfeawqsw` when the Strategic Delta was built, while the Foundry-layer tables (`actions` 8, `events` 11, `evidence_items` 4, `routed_requests` 4) had real data. Anything human-facing that predicts from mission state therefore renders its insufficient-context path until someone creates a Primary mission with a finish line. Check row counts before diagnosing a "broken" prediction — and design the empty path first, because it is the one that actually ships.
  - **2026-09-01 — Anonymous auth means demo state is per-browser.** `signInAnonymously()` scopes missions by `user_id` under RLS, so a fresh device or cleared browser is a *new* user with zero missions. A demo on an unfamiliar device starts empty by construction, not by failure.
  - **2026-09-01 — Local dev cannot sign in without `.env.local`.** `src/lib/supabase/client.ts` falls back to the literal string `your-anon-key-here`, which constructs a client successfully but 401s on every call. Console 401s plus "Sign-in failed" locally are expected, not a regression.

## Update protocol

After any session that ships, blocks, or unblocks something for this repo: update `codex-control-panel/STATE.md` (canonical), not this file. Only add to this file's Repo-local notes section above if a note genuinely wouldn't make sense in the cross-project file.
