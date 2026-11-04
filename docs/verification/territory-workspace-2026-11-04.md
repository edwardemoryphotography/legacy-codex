# Territory workspace — Path 1 verification

**Status:** implementation and local verification complete; canonical migration
not yet applied.
**Spec:** `docs/superpowers/specs/2026-11-03-territory-workspace-design.md`

## Implemented

- Map/List Territory workspace with All / Missions / Projects / Doctrine /
  Constraints lenses.
- First-class owner-scoped `territory_nodes` for projects, doctrine and
  constraints: label, description, optional saved signal, optional cluster.
- Entity cards on the map (above mission cards), entity list cards, focused
  entity inspector, create/edit/delete, and two-step delete.
- Existing mission focus and Brief actions preserved.
- Explicit pending, failed, and empty entity states. A failed entity read is
  never displayed as an empty ecosystem.
- No entity-to-mission edges are drawn. The additive `territory_links` schema is
  designed in the spec for Path 2.

## Automated checks

- `npx vitest run`: 621 tests passed, including new graph and Territory UI
  tests for entitity layout, create/edit/delete, lens filtering, and failed
  reads.
- `npx tsc --noEmit`: passed.
- `npm run lint`: 0 errors (warnings only).
- `npm run build`: passed.

## Isolated PostgreSQL 17 verification

Loaded `supabase/migrations/20261104000000_territory_nodes.sql` into a fresh
local database with `auth.uid()` and `authenticated`/`anon` roles.

- Owner could insert, read and update a territory node.
- A different authenticated account read 0 rows and its update/delete affected
  0 rows.
- A cross-account insert was rejected by the RLS `WITH CHECK`.
- `kind = 'nonsense'` was rejected by the check constraint.
- A blank/whitespace label was rejected by the check constraint.
- The owner row was still present after the second account's write attempts.

No production missions, actions, lessons, or territory nodes were created as
proof.

## Release sequence

1. Apply `20261104000000_territory_nodes.sql` to the canonical Supabase
   project.
2. Merge the client PR through normal protections.
3. Deploy and verify the canonical Territory tab with a real session.
4. Exercise create/edit/delete on the canonical account only after the table is
   present; do not leave test entities behind.
