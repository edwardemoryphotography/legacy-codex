# Territory Path 2 — saved connections, active state, log, AI workspace

Canonical: https://legacy-codex.vercel.app
Base: `8b52afe` (production before Path 2)
Branch: `feat/territory-path2`

## What was added

- `public.territory_links`: owner-scoped relationships between missions and
  first-class territory entities. A trigger verifies both endpoints belong to
  the same account; a unique index prevents duplicate relationships.
- `public.territory_state`: active project, energy and next safe action, one row
  per owner.
- `public.territory_events`: append-only state/link/log history.
- Territory workspace panel: active state, connection creation/removal, state
  log, JSON export and a question box that reuses the existing owner-gated Brief
  runner.
- The graph draws saved connections as dashed edges with the recorded
  relationship label. No edge is inferred.
- Mission/entity graph node ids now use the stable `node:<uuid>` form so links
  survive entity kind changes.

The dashboard is not a port of the artifact’s hardcoded 27-node/29-edge data,
localStorage state, or artifact-only Claude call. Those remain excluded.

## Database verification

Migration applied to the production Supabase project
`pkydkbuodikttfeawqsw` on 2026-11-04. Verified in the SQL editor:

- `territory_links`, `territory_state`, `territory_events` exist with
  `rowsecurity = true`.
- Eight owner-scoped policies exist across the three tables.
- A temporary local PostgreSQL 17 instance loaded the migration with the same
  schema stubs and exercised two accounts:
  - account A could link its own mission to its own entity;
  - account B saw zero rows of A’s links, state and events;
  - B’s attempt to link to A’s entity was rejected by the trigger;
  - B could link its own records;
  - a duplicate relationship was rejected by the unique index;
  - B’s update of A’s state changed 0 rows.
- No owner data was used or written for these checks.

## UI verification

Local production build against the production Supabase project, 390×844,
non-owner anonymous verification account:

- Created two temporary territory entities, one saved connection
  (`Verification Project — verified by → Verification Doctrine`), one active
  state (`Verification Project · Steady · Inspect the real graph`) and one log
  entry.
- Reloaded the page: state, connection, log and graph edge all returned.
- Document width 385 = client width 385; no horizontal overflow.
- The connection form now labels **From / Relationship / To** and stacks them on
  phones; options carry their record kind.
- The verification records were deleted after the check; counts returned to
  zero.

## Not verified

- Owner-session runtime: this browser account is not the owner, so the AI
  question box and the owner-gated Brief response were not exercised.
- The demo mission/action path remains the cousin-demo blocker.
- The visual is the existing deterministic Territory graph with saved-link
  edges, not a D3 force simulation. Node positions are not persisted.
- No new AI provider, route or secret was added.

## Commands

```bash
npx vitest run       # 639 tests expected after this change
npx tsc --noEmit
npm run lint
npm run build
```
