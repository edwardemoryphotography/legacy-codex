# NextAction contract — final gap checklist

Status: implementation complete; the additive `replace_saved_action_atomic`
migration is applied to the canonical Supabase project and the database
transaction/rollback checks passed.

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
- The function is verified in the canonical database as a security-invoker
  function. A rolled-back transaction exercised success, retry, stale-version
  conflict, A→B→A→B, and in-progress rejection; it left 0 test missions,
  0 actions, and 0 events after rollback. A forced history-insert failure was
  not injected because the SQL editor role does not own `mission_events`;
  atomicity there rests on the single PL/pgSQL transaction.
- Completion remains a human report, not independent verification.

## Verification run

- Canonical database: `replace_saved_action_atomic` exists with
  `security_definer = false`.
- Transactional test: final history count `4` after success + retry +
  A→B→A→B; conflict and in-progress guards fired; rollback counts
  missions/actions/events = `0/0/0`.
- `npx vitest run`: full suite passed (including `replaceSavedAction` unit
  tests, NextAction ledger tests, Mission/Home/Brief UI tests).
- `npx tsc --noEmit`, `npm run lint` (0 errors), `npm run build`: passed.
- Migration file: `supabase/migrations/20261103000000_atomic_replace_saved_action.sql`.

## Release note

The migration is applied. The client may now be merged and deployed; if the
function is ever absent, replacement fails closed and creates neither an update
nor a false history row.
