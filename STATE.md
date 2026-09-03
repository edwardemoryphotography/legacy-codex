# STATE.md — legacy-codex (local pointer)

**Canonical cross-project state lives in `codex-control-panel/STATE.md`** (Master Charter §8, Standards Kit 2.1.0) — read that first for shipped / blocked / next / active governance rules / stack & keys reference / canonical repo locations.

This file used to keep its own independent copy of that same content. It drifted: this repo's copy was still dated 2026-06-15 while `codex-control-panel`'s was newer, and both were missing entries the other had. As of 2026-08-10, everything real from this file's copy — including the two entries below that only existed here — has been merged into the hub's canonical copy, and this file is now a pointer plus genuinely repo-local notes only.

## Repo-local notes

- **FREEZE SPEC**: don't rewrite `src/app/` (`page.tsx`, `layout.tsx`, `globals.css`, `api/`), `src/components/`, `src/lib/`, or `src/hooks/` unless Eddie explicitly says "REWRITE THE APP CODE". Docs, config, and coordination files (including this one) are not frozen. **Corrected 2026-08-10, Eddie-approved:** this rule previously cited `app/index.html`, which does not exist in this repo (Next.js App Router; real entry is `src/app/page.tsx`) — the freeze was guarding a phantom path while the actual app code sat unprotected. **Do not restore the old `app/index.html` wording.**
- **LESSONS** — durable, *repo-specific* improvement notes (not cross-project — those go in the hub's `STATE.md`). Add an entry only when a lesson is likely to help a future session working in this repo specifically.
  - Home is the Mission tab (`CodexApp` default `activeTab`). The next-action surface is the **Right Now** card, not Overview's Foundry readout and not a second panel. Visual emphasis belongs there. `.card` padding in `globals.css` is `!important`, so extra space has to come from an inner wrapper, not `Card` `style.padding`.
  - Evidence-bridge commit step must `git add` then `git diff --cached`. Plain `git diff` ignores untracked files, so a first-time `public/notes/evidence-snapshot.json` false-greens as "No evidence changes." Observed on Actions run 33690187232 (2026-09-02).

## Update protocol

After any session that ships, blocks, or unblocks something for this repo: update `codex-control-panel/STATE.md` (canonical), not this file. Only add to this file's Repo-local notes section above if a note genuinely wouldn't make sense in the cross-project file.
