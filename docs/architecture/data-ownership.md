# Legacy Codex Data Ownership

**Status:** Canonical ownership contract
**Last migration baseline review:** 2026-08-31
**Current source/ownership reconciliation:** 2026-11-04 (not a new production-policy audit)

The current repository contains both the human Mission Loop and Foundry's technical work/evidence infrastructure. They are related, but they are not interchangeable.

| Store | Canonical responsibility | Current status |
| --- | --- | --- |
| `missions` | Durable human outcomes and finish lines | **CANONICAL** for the human execution loop |
| `actions` | Executable technical or operational work units | **CANONICAL** for Foundry work items |
| `evidence_items` | Evidence authority for routed requests and work items | **CANONICAL** evidence store |
| `events` | Generic append-only audit ledger | **CANONICAL** event history |
| `routed_requests` | Validated routing decisions and correction chains | **CANONICAL** routing record |
| `evidence_snapshots` | Read model currently consumed by the Mission UI and evidence bridge | **TRANSITIONAL / DERIVED**; no new authority should be added here |
| `mission_events` | Mission-specific UI event stream | **TRANSITIONAL**; keep append-only while Mission behavior moves toward the generic event contract |
| `territory_nodes` | Owner-scoped projects, doctrine and constraints in Territory | **CANONICAL** for these explicit entities (#168/#169); does not create evidence authority or inferred links |

Project-review caches and scoped, human-confirmed lessons use this transitional
Mission ledger (`delta_reviewed`, `delta_lesson_confirmed`,
`delta_lesson_retired`). A confirmation preserves the review's source references;
a retirement appends history instead of erasing the rule. These records are
operating guidance for the current Mission UI, not canonical evidence, generic
cross-system audit authority, or a new owner of the Goose Cookbook doctrine.

## Boundary rules

1. A mission is an outcome; an action is a unit of work. Do not collapse one into the other.
2. New evidence authority belongs in `evidence_items`. `evidence_snapshots` may mirror or project evidence for the Mission UI but must not become a competing truth source.
3. New cross-system audit behavior belongs in `events`. `mission_events` remains only for compatibility with the current Mission UI until a forward migration exists.
4. Corrections append or supersede; they do not rewrite historical facts.
5. `Merged != Deployed != Runtime Verified != Live` applies to every evidence claim.
6. No table is dropped, renamed, or backfilled merely to make the model look cleaner. Production-data migration requires a separately verified forward plan.

## Current migration consequence

This contract resolves the prior documentation conflict without pretending the database has already been consolidated. The next schema milestone is a forward-only projection from canonical `evidence_items`/`events` into the Mission experience, followed by retirement of the transitional stores only after production parity and data preservation are proven.

## Forward convergence plan — November 4

1. Inventory actual consumers and event shapes for reviews, lesson confirmation/retirement/Relay, correction, acceptance and replacement history; preserve idempotency keys, account/mission scope, timestamps and provenance.
2. Design a forward projection from canonical evidence_items/events with explicit mappings for every existing Mission event type. A projection must not elevate a human report or model review into verified evidence.
3. Validate on existing authorized records in a non-writing comparison: counts, action/lesson identity, retirement folds, latest-acceptance precedence, retries, ordering, read failures and account isolation. Record missing real cases rather than fabricating success histories.
4. Keep current writes authoritative until a separately reviewed cutover preserves transaction/idempotency behavior and has a tested rollback. Avoid uncontrolled dual writes or a second generic ledger.
5. Change reads only after parity and owner continuity are established. Retain historical/transitional rows until retention and rollback requirements are satisfied. No destructive production migration is authorized by this plan alone.

The November document reconciliation does not apply a schema migration, move account records, retire a store or widen grants.
