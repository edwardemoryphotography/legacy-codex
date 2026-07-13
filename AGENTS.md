# AGENTS.md — Workspace Router

This is the Legacy Codex / Artful Intelligence coordination workspace: a Next.js dashboard repo plus a set of docs that let an agent resume approved work without replaying prior conversation history.
Read this file first at the start of a session to get workspace context, then read STATE.md for the latest project status. This router links to STATE.md, TODOS.md, TRIAGE-STATE.md, NEXT-ACTION-LOG.md, FABLE-LEADER-KIT.md, and AGENT_FEEDBACK.md.
Scope: docs/coordination only for this task family — never touch legacy-codex `app/index.html` (frozen, see STATE.md § FROZEN).

---

## Where things live, and when to read them

| File | Purpose | Read when |
|---|---|---|
| `STATE.md` | High-level shipped / blocked / next snapshot, frozen-file list, stack & key reference | Immediately after this file |
| `TODOS.md` | Approved task queue — Now / Next / Later | Deciding what to pick up next |
| `TRIAGE-STATE.md` | Current triage pass over open items — what's been sorted, what's pending | Before triaging, or before picking up a flagged item |
| `NEXT-ACTION-LOG.md` | Running handoff log — what the last agent did and what's next | Resuming an interrupted task |
| `FABLE-LEADER-KIT.md` | Leadership/onboarding reference kit for this workspace | Onboarding a new agent or session |
| `AGENT_FEEDBACK.md` | Durable, repository-specific improvement notes | When a relevant prior lesson may apply |

## Scope

This router and the files it points to are coordination documents. They do not grant permission to modify application code, external systems, or production data.

**Never touch legacy-codex `app/index.html`.** It is under a freeze spec per `STATE.md` — no rewrite unless explicitly told "REWRITE THE APP CODE".

## RULES

1. **Verify before claiming done.** Run or otherwise check your work; don't report success on an unverified change.
2. **Keep handoffs current.** Update `NEXT-ACTION-LOG.md` when meaningful work is intentionally left incomplete.
3. **Record only durable lessons.** Append to `AGENT_FEEDBACK.md` only when a repository-specific improvement is worth preserving.
4. **Smallest safe patch, always.** Prefer the minimal change that satisfies the request over a broader rewrite.
