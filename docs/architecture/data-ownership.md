# Legacy Codex Data Ownership

**Status:** Canonical ownership contract
**Last verified against repository migrations:** 2026-08-31

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

## Boundary rules

1. A mission is an outcome; an action is a unit of work. Do not collapse one into the other.
2. New evidence authority belongs in `evidence_items`. `evidence_snapshots` may mirror or project evidence for the Mission UI but must not become a competing truth source.
3. New cross-system audit behavior belongs in `events`. `mission_events` remains only for compatibility with the current Mission UI until a forward migration exists.
4. Corrections append or supersede; they do not rewrite historical facts.
5. `Merged != Deployed != Runtime Verified != Live` applies to every evidence claim.
6. No table is dropped, renamed, or backfilled merely to make the model look cleaner. Production-data migration requires a separately verified forward plan.

## Current migration consequence

This contract resolves the prior documentation conflict without pretending the database has already been consolidated. The next schema milestone is a forward-only projection from canonical `evidence_items`/`events` into the Mission experience, followed by retirement of the transitional stores only after production parity and data preservation are proven.
