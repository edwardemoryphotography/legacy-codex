# AGENTS.md — Workspace Router

This is the Legacy Codex / Artful Intelligence coordination workspace: a Next.js dashboard repo plus two docs that let an agent resume approved work without replaying prior conversation history.
Read this file first at the start of a session, then read `STATE.md` for the latest project status and `TODOS.md` for the approved task queue.
Scope: docs/coordination only for this task family — never touch legacy-codex `app/index.html` (frozen, see STATE.md § FROZEN).

---

## Where things live, and when to read them

| File | Purpose | Read when |
|---|---|---|
| `STATE.md` | Shipped / blocked / next snapshot, frozen-file list, stack & key reference, durable lessons | Immediately after this file |
| `TODOS.md` | Approved task queue — Inbox / Now / Next / Later | Deciding what to pick up next |

## Scope

This router and the files it points to are coordination documents. They do not grant permission to modify application code, external systems, or production data.

**Never touch legacy-codex `app/index.html`.** It is under a freeze spec per `STATE.md` — no rewrite unless explicitly told "REWRITE THE APP CODE".

## RULES

1. **Verify before claiming done.** Run or otherwise check your work; don't report success on an unverified change.
2. **Keep `STATE.md` current.** Update its shipped / blocked / next lines after any session that changes them, per its own Update Protocol.
3. **Record only durable lessons.** Append to `STATE.md` § LESSONS only when a repository-specific improvement is worth preserving.
4. **Smallest safe patch, always.** Prefer the minimal change that satisfies the request over a broader rewrite.
