# Territory workspace — Path 1 verification

**Status:** implementation complete; migration applied; merged, deployed and live.
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
  tests for entity layout, create/edit/delete, lens filtering, and failed
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

## Canonical database verification

- Applied `20261104000000_territory_nodes.sql` to the canonical Supabase project
  through the SQL editor.
- `information_schema.tables` confirms `public.territory_nodes` exists.
- `pg_policies` confirms owner SELECT, INSERT, UPDATE and DELETE policies.
- The table had 0 rows immediately after migration; no production records were
  fabricated.

## Release evidence

- **Merged:** [PR #168](https://github.com/edwardemoryphotography/legacy-codex/pull/168)
  (`da93627`) and the first-entity empty-state fix
  [PR #169](https://github.com/edwardemoryphotography/legacy-codex/pull/169)
  (`b86831b`).
- **Migration applied:** `public.territory_nodes` exists with 0 rows and four
  owner policies (SELECT/INSERT/UPDATE/DELETE).
- **Deployed:** `dpl_7fQxy8JRtzd2rxQB2v68cfy8znTy`, canonical
  `https://legacy-codex.vercel.app`, Ready at `b86831b`.
- **Runtime verified (non-writing):** the canonical Territory tab loaded the
  Map workspace; with a new/empty account it showed the explicit empty copy and
  the **+ Add entity** control, with no entity-read error. This confirms the
  client can reach `territory_nodes` under RLS. A real-account create/edit/delete
  walk was not performed because this browser session is a new anonymous
  account; the owner CRUD path is covered by the isolated PostgreSQL test below.
- **Final repository checks:** 622 Vitest tests, `tsc --noEmit`, lint (0 errors),
  production build.
- **Still device-only:** sign in on the canonical account, add/edit/delete one
  real project/doctrine/constraint, and confirm the phone focus view. Clean up
  any test entity afterward.

## Release sequence

1. ~~Apply the migration.~~ Done.
2. ~~Merge the client PR through normal protections.~~ Done (`#168`, `#169`).
3. ~~Deploy and verify the canonical Territory tab.~~ Done for the non-writing
   path; real-account CRUD remains device confirmation.
4. Exercise create/edit/delete on the canonical account with real content; do
   not leave test entities behind.
