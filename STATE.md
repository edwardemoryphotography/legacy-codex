# STATE.md — legacy-codex (local pointer)

**Canonical cross-project state lives in `codex-control-panel/STATE.md`** (Master Charter §8, Standards Kit 2.1.0) — read that first for shipped / blocked / next / active governance rules / stack & keys reference / canonical repo locations.

This file used to keep its own independent copy of that same content. It drifted: this repo's copy was still dated 2026-06-15 while `codex-control-panel`'s was newer, and both were missing entries the other had. As of 2026-08-10, everything real from this file's copy — including the two entries below that only existed here — has been merged into the hub's canonical copy, and this file is now a pointer plus genuinely repo-local notes only.

## Repo-local notes

- **FREEZE SPEC**: this repo's application source is frozen — no rewrite unless Eddie explicitly says "REWRITE THE APP CODE". Every existing copy of this rule (including this file's own prior version) cited the path `app/index.html`, which **does not exist** in this repo — it's a Next.js App Router app; the real entry point is `src/app/page.tsx` / `src/components/CodexApp.tsx`. Flagged during the 2026-08-10 standards audit rather than silently propagated. Until Eddie confirms the current frozen scope, treat the freeze as covering everything under `src/`.
- **LESSONS** — durable, *repo-specific* improvement notes (not cross-project — those go in the hub's `STATE.md`). Add an entry only when a lesson is likely to help a future session working in this repo specifically.
  _(none yet)_

## Update protocol

After any session that ships, blocks, or unblocks something for this repo: update `codex-control-panel/STATE.md` (canonical), not this file. Only add to this file's Repo-local notes section above if a note genuinely wouldn't make sense in the cross-project file.
