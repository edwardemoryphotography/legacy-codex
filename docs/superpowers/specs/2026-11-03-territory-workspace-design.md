# Territory workspace — Path 1 design

**Status:** implemented and released; `territory_links` remains Path 2
**Scope:** the existing Territory tab, not a new product surface
**Reference:** `Legacy Codex Territory Dashboard.html` (standalone prototype)

## Purpose

Turn Territory into a legible map of the person's work: saved missions **and**
first-class non-mission entities (projects, doctrine, constraints), with a
focused inspector instead of a dashboard of permanent panels.

Path 1 remains honest: no invented relationships, no second action system, no
second AI path. `territory_links` is designed here but not created until Path 2.

## What ships in Path 1

- A **Map / List** toggle. Map is the default; List remains the readable fallback.
- A compact **lens** bar: All, Missions, Projects, Doctrine, Constraints.
- First-class **territory nodes** for projects, doctrine, and constraints:
  - `label`, `kind`, `description`, optional `signal`, optional `cluster`.
  - Owner-scoped CRUD through `territory_nodes` under RLS.
- **First-class nodes on the map**: project/doctrine/constraint cards rendered
  alongside mission cards. No edges are drawn to them yet; none are saved.
- A **Focus inspector**:
  - Selecting a mission opens the existing mission detail and Brief actions.
  - Selecting an entity opens its saved facts plus Edit/Delete.
  - On a phone the inspector replaces the map, so it is a sheet-like focus view,
    not a shrunken permanent right rail.
- Existing **Active State** remains a compact card above the map/list.
- Empty states distinguish “nothing saved” from “could not read”.
- A read failure for territory nodes is explicit; it is never shown as an empty
  ecosystem.

## Data model — `territory_nodes`

```sql
create table public.territory_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('project', 'doctrine', 'constraint')),
  label text not null check (char_length(btrim(label)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  signal text check (signal in ('ship', 'wip', 'proto', 'frozen', 'failed')),
  cluster text check (char_length(cluster) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Owner-only RLS: select/insert/update/delete require `user_id = auth.uid()`.
No admin bypass. `updated_at` is maintained by a trigger. `signal` is a label,
not a computed truth; the UI names it as saved status.

## Additive Path 2 — `territory_links` schema

Designed now, created later. Polymorphic endpoints keep missions canonical and
territory nodes first-class without adding a second mission table.

```sql
create table public.territory_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  from_kind text not null check (from_kind in ('mission', 'territory_node')),
  from_id uuid not null,
  to_kind text not null check (to_kind in ('mission', 'territory_node')),
  to_id uuid not null,
  relation text not null check (char_length(btrim(relation)) between 1 and 80),
  provenance text not null default 'person'
    check (provenance in ('person', 'mission_event', 'import')),
  created_at timestamptz not null default now(),
  constraint territory_links_distinct_endpoints
    check (from_kind <> to_kind or from_id <> to_id)
);
create unique index territory_links_unique
  on public.territory_links (user_id, from_kind, from_id, to_kind, to_id, relation);
```

Path 2 validation (trigger or RPC, not a client assumption): the caller owns
both endpoints; a mission endpoint exists in `missions.user_id`; a
`territory_node` endpoint exists in `territory_nodes.user_id`; no self-link.
RLS is owner-only; no service-role admin path is introduced. Edges render only
when a link row exists, and the edge label carries `relation` plus `provenance`.

## Layout

- Entities are laid out in a compact section above mission cards. The graph
  builder remains deterministic; no force simulation and no saved canvas
  positions. This keeps phone layout and tests predictable.
- Entity cards use the same 200×72 footprint as mission cards. Kind colour names
  the record type; it never implies progress.
- No entity-to-mission lines until Path 2. The UI says so explicitly rather than
  drawing decorative connections.

## Interaction

- Selecting a node must be a single gesture/click; keyboard Enter/Space works.
- Back returns to the map/list without losing the lens.
- “Add entity” opens a compact editor. Save is disabled until label is present.
- Edit uses the same editor, prefilled. Delete requires a second explicit tap
  (“Delete” → “Confirm delete”), not a browser modal.
- The map remains pannable/draggable only where it already was; entity cards are
  selectable, not draggable into invented positions.

## Error and loading states

- `territory_nodes` pending: map still renders missions; entity section says
  “Loading territory entities…”.
- failed: “Territory entities could not be read right now. Nothing was changed.”
- save failure: inline error, form remains open, draft preserved.
- delete failure: inline error, entity remains.
- no missions and no entities: “Unknown — add a mission in Mission first, or add
  a project, doctrine, or constraint here.”

## Testing

- Pure graph test: entities render as first-class nodes, layout does not overlap
  mission cards, empty entity list is unchanged.
- UI tests: create project; lens filters; select entity; edit label; failed read
  is explicit; delete confirmation; mission focus still opens Brief actions.
- Migration test in isolated PostgreSQL: RLS owner can CRUD; another user cannot
  read/update/delete; label/kind constraints reject invalid rows.
- Repository gates: Vitest, `tsc --noEmit`, lint, production build.

## Non-goals

- No `territory_links` table or edges in Path 1.
- No navigation redesign, new tab, native wrapper, widgets, or new AI workspace.
- No localStorage truth for nodes, logs, energy, or positions.
- No hardcoded project/doctrine/constraint data in production.
