# AGENTS.md — Workspace Router

This is the Legacy Codex / Artful Intelligence coordination workspace: a Next.js dashboard repo plus a set of docs that let any agent resume work without replaying prior conversation history.
Read this file first at the start of every session to get workspace context, then immediately read STATE.md for the latest project status. This router links to STATE.md, TODOS.md, TRIAGE-STATE.md, NEXT-ACTION-LOG.md, FABLE-LEADER-KIT.md, and AGENT_FEEDBACK.md.
Scope: docs/coordination only for this task family — never touch legacy-codex `app/index.html` (frozen, see STATE.md § FROZEN).

---

## Where things live, and when to read them

| File | Purpose | Read when |
|---|---|---|
| `STATE.md` | High-level shipped / blocked / next snapshot, frozen-file list, stack & key reference | Immediately after this file, every session |
| `TODOS.md` | Task queue — Now / Next / Later | Deciding what to pick up next |
| `TRIAGE-STATE.md` | Current triage pass over open items — what's been sorted, what's pending | Before triaging, or before picking up a flagged item |
| `NEXT-ACTION-LOG.md` | Running handoff log — what the last agent did and what's next | Resuming a task mid-way, or after a session was interrupted |
| `FABLE-LEADER-KIT.md` | Leadership/onboarding reference kit for this workspace | Onboarding a new agent or session |
| `AGENT_FEEDBACK.md` | Append-only improvement notes from past sessions | End of session (to add one); periodically to spot patterns |

## Scope

This router and the files it points to are markdown/coordination docs only. Do not use them as a place to modify application code.

**Never touch legacy-codex `app/index.html`.** It is under a freeze spec per `STATE.md` — no rewrite unless explicitly told "REWRITE THE APP CODE".

## RULES

1. **Verify before claiming done.** Run or otherwise check your work; don't report success on an unverified change.
2. **Update `NEXT-ACTION-LOG.md`** after meaningful progress, so a fresh agent could resume mid-task with no other context.
3. **End every session** by appending one improvement note to `AGENT_FEEDBACK.md`.
4. **Smallest safe patch, always.** Prefer the minimal change that satisfies the request over a broader rewrite.
