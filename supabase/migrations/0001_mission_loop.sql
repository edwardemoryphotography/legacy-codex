-- Mission Loop: missions, mission_events, evidence_snapshots.
-- Additive only — no existing table is altered except one new nullable
-- column on nd_captures. Mirrors the anon-auth + user_id RLS pattern already
-- used by nd_prefs / nd_captures / nd_codex_bookmarks (see
-- src/lib/supabase/client.ts) rather than introducing a second auth model.
--
-- First migration file in this repo's supabase/ directory — there is no
-- prior migration history to conflict with.

-- ─── missions ──────────────────────────────────────────────────────────
create table if not exists missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  why text not null default '',
  finish_line text,
  evidence_requirement text,
  state text not null default 'candidate'
    check (state in ('candidate', 'parked', 'primary', 'secondary', 'blocked', 'completed', 'paused', 'abandoned')),
  blocker text,
  capacity_mismatch boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one Primary and one Secondary mission per user at a time
-- (spec: mission lifecycle rules; success criterion: "No more than one
-- Primary and one Secondary mission can be active").
create unique index if not exists missions_one_primary_per_user
  on missions (user_id) where (state = 'primary');
create unique index if not exists missions_one_secondary_per_user
  on missions (user_id) where (state = 'secondary');

alter table missions enable row level security;

drop policy if exists "missions owner select" on missions;
create policy "missions owner select" on missions
  for select using (auth.uid() = user_id);

drop policy if exists "missions owner insert" on missions;
create policy "missions owner insert" on missions
  for insert with check (auth.uid() = user_id);

drop policy if exists "missions owner update" on missions;
create policy "missions owner update" on missions
  for update using (auth.uid() = user_id);

drop policy if exists "missions owner delete" on missions;
create policy "missions owner delete" on missions
  for delete using (auth.uid() = user_id);

-- ─── mission_events ────────────────────────────────────────────────────
-- Append-only audit trail — mirrors foundry-console's `events` table, which
-- already satisfies "retrying must not duplicate events" by construction.
create table if not exists mission_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  mission_id uuid not null references missions(id) on delete cascade,
  type text not null,
  detail text not null default '',
  idempotency_key text,
  created_at timestamptz not null default now()
);

-- A retried write reusing the same idempotency_key must not create a second
-- event row (spec §8: "Retrying must not duplicate events or completion
-- records").
create unique index if not exists mission_events_idempotency
  on mission_events (user_id, idempotency_key) where (idempotency_key is not null);

alter table mission_events enable row level security;

drop policy if exists "mission_events owner select" on mission_events;
create policy "mission_events owner select" on mission_events
  for select using (auth.uid() = user_id);

-- The insert check must also confirm the target mission belongs to this
-- user — auth.uid() = user_id alone lets an authenticated user attach an
-- event (with their own user_id) to someone else's mission_id, polluting
-- another user's audit trail. This closes that hole.
drop policy if exists "mission_events owner insert" on mission_events;
create policy "mission_events owner insert" on mission_events
  for insert with check (
    auth.uid() = user_id and
    exists (
      select 1 from missions
      where missions.id = mission_id
      and missions.user_id = auth.uid()
    )
  );

-- Deliberately no update or delete policy — append-only under RLS.

-- ─── evidence_snapshots ────────────────────────────────────────────────
-- Populated by the scheduled evidence-bridge GitHub Action
-- (.github/workflows/evidence-bridge.yml) using the service-role key, which
-- bypasses RLS. The client reads this table and, to link a snapshot to a
-- mission it belongs to, updates mission_id — insert/delete stay
-- service-role only.
create table if not exists evidence_snapshots (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references missions(id) on delete set null,
  source text not null,
  kind text not null
    check (kind in ('merged_pr', 'live_deployment', 'published_artifact', 'confirmed_action', 'custom')),
  status text not null
    check (status in ('verified', 'unverified', 'conflict', 'stale')),
  claim text not null,
  observed_at timestamptz not null,
  fetched_at timestamptz not null default now()
);

alter table evidence_snapshots enable row level security;

drop policy if exists "evidence_snapshots authenticated read" on evidence_snapshots;
create policy "evidence_snapshots authenticated read" on evidence_snapshots
  for select using (auth.role() = 'authenticated');

-- A client may only link an unlinked snapshot (mission_id is null) or one
-- already linked to a mission it owns, and may only ever set mission_id to
-- null or to a mission it owns — never to someone else's mission.
drop policy if exists "evidence_snapshots owner update" on evidence_snapshots;
create policy "evidence_snapshots owner update" on evidence_snapshots
  for update using (
    mission_id is null or exists (
      select 1 from missions
      where missions.id = evidence_snapshots.mission_id
      and missions.user_id = auth.uid()
    )
  ) with check (
    mission_id is null or exists (
      select 1 from missions
      where missions.id = mission_id
      and missions.user_id = auth.uid()
    )
  );

-- ─── nd_captures: link a capture to the mission it was promoted into ───
-- Null promoted_mission_id is the default Parked state for a captured idea
-- (spec §6); setting it links the capture to the mission it became, so
-- Mission Screen and Controls share one capture pipeline instead of two.
alter table nd_captures add column if not exists promoted_mission_id uuid references missions(id) on delete set null;
