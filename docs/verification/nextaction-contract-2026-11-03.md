# NextAction contract — final gap checklist

Status: implementation prepared; release is blocked on applying the additive
`replace_saved_action_atomic` migration to the canonical Supabase project.

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
- The SQL function is transactionally atomic by construction, but this
  environment has no local Postgres/Docker and no service-role or database
  credential. `supabase projects list` is unavailable; the migration was not
  applied and the rollback/conflict paths were not injected against a database.
  Mocked client tests do not prove rollback.
- Completion remains a human report, not independent verification.

## Verification run

- `npx vitest run`: full suite passed (including `replaceSavedAction` unit
  tests, NextAction ledger tests, Mission/Home/Brief UI tests).
- `npx tsc --noEmit`, `npm run lint` (0 errors), `npm run build`: passed.
- Migration file: `supabase/migrations/20261103000000_atomic_replace_saved_action.sql`.

## Release blocker

The migration must be applied by an authorized database operator before the
client is merged/deployed. Without it, replacement attempts fail closed and
create neither an update nor a false history row.
