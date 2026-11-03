# NextAction contract — final gap checklist

Status: complete. The additive `replace_saved_action_atomic` migration is
applied to the canonical Supabase project; the client is merged and deployed;
the transaction, rollback, concurrency, and failure-path checks below passed.

## Closed in this change

- **Replacement/history atomicity.** `MissionTab` now calls one
  `replace_saved_action_atomic` RPC instead of inserting `action_replaced` and
  then updating `actions` separately. The function verifies ownership, mission,
  `TODO` status, and the source `updated_at`, locks the action, writes the
  history row and the validated update in one transaction, and returns the
  resulting action snapshot.
- **Transition identity.** The event idempotency key includes the action, its
  source `updated_at`, the new title, and the new note. A retry of one
  transition is idempotent; A→B→A→B keeps distinct source versions.
- **In-progress protection.** The RPC refuses any action whose status is not
  `TODO`; the client still blocks implicit replacement of in-progress work.
- **Single shared acceptance fold.** `src/lib/nextActionLedger.ts` now owns the
  acceptance ledger previously embedded in `MissionTab`.
- **Home and Brief acceptance context.** Both consumers read the same
  account-scoped `mission_events` acceptance fold and pass it to
  `deriveNextAction`; saved/in-progress commitments still outrank acceptance,
  and acceptance outranks an absent prediction.
- **No false stale state.** An accepted move is not marked stale merely because
  Home/Brief do not recompute a Delta. Mission marks it stale when a recomputed
  Delta no longer matches.

## Still bounded

- Home and Brief project persisted state (saved action and acceptance). They do
  not recompute the richer Mission Delta (model assistance, project review,
  evidence freshness); a prediction is still surfaced on Mission, where its
  context is available. They never invent a prediction.
- Completion remains a human report, not independent verification.
- A real production replacement was not performed against Eddie's account.
  Production runtime verification is the non-writing Mission load below.

## Verification run

- **Canonical database:** `replace_saved_action_atomic` exists with
  `security_definer = false`.
- **Canonical rolled-back transaction:** success, retry, stale-version conflict,
  A→B→A→B, and in-progress rejection; final history count `4`; rollback left
  missions/actions/events = `0/0/0`.
- **Isolated local PostgreSQL 17:** success; duplicate retry produced one event;
  stale-version conflict left the action unchanged and added no event;
  A→B→A→B produced four distinct history rows; in-progress replacement was
  refused; a forced history-insert failure rolled back the update and left the
  action and the four-event history unchanged.
- **Concurrency, isolated local PostgreSQL:** session A held the row, replaced
  `Old → Concurrent A`, and committed; session B used the same source version
  and a different title, waited on the lock, then was rejected with
  `Saved action changed in another tab`; final action was `Concurrent A`, with
  one new event and no B event.
- `npx vitest run`: full suite passed (including `replaceSavedAction` unit
  tests, NextAction ledger tests, Mission/Home/Brief UI tests).
- `npx tsc --noEmit`, `npm run lint` (0 errors), `npm run build`: passed.
- Migration file: `supabase/migrations/20261103000000_atomic_replace_saved_action.sql`.

## Final release state

- **Implemented:** atomic replacement RPC and client path; source-version
  identity; shared acceptance read for Home/Brief.
- **Tested:** repository checks plus the canonical and isolated-database
  evidence above.
- **Merged:** [PR #159](https://github.com/edwardemoryphotography/legacy-codex/pull/159),
  merge commit `201f5376e50bf84a5b25b60c12f24ac66b144495`.
- **Deployed:** `dpl_BPvWieQ5gDz8eKqvKptaNY9xQGiA`, canonical
  `https://legacy-codex.vercel.app`, status Ready.
- **Runtime Verified:** non-writing production Mission load showed the real
  saved action “Provide one source six evidence records” and no read/error
  state. An actual replacement against Eddie's account was not performed.
- **Live:** canonical production served the merged bundle.

## Governing context corrections

These corrections govern interpretation; they do not create a new doctrine
owner. The canonical Goose Cookbook and `AGENTS.md` remain authoritative.

1. **Understanding does not always have to produce an action.** Discovery,
   creation, exploration, synthesis, and recognition are valid outcomes before
   a mission or commitment exists. NextAction is one useful expression, not the
   required destination of every interaction.
2. **A correction is a candidate lesson, not automatically a rule.** Preserve
   what happened, the proposed lesson, its scope, who confirmed it, later
   supporting/challenging evidence, uncertainty, and a retirement path. Do not
   promote a model interpretation merely because it sounds coherent.
3. **The Argon-to-DeepSeek recovery is an acceptance case, not proof that
   Legacy Codex has demonstrated reliable inheritance.** The human, harness,
   files, Git, and tools performed substantial coordination. Product claims
   require evidence of what Codex preserved, what the receiving intelligence
   obtained from Codex, how that changed its behavior, and what established
   successful continuation.
4. **No new feature stream is authorized by this handoff.** Navigation redesign,
   a new Handoff surface, lesson-graduation workflow, “What changed” ledger,
   native wrapper/widgets/Shortcuts, or a separate notes/chat system remain
   proposals only.

If the RPC is ever absent, replacement fails closed and creates neither an
update nor a false history row.
