-- Baseline for the Foundry tables the routing control plane depends on.
--
-- routed_requests (20260804010000) references workspaces(id), and the
-- hardening migration (20260804020000) adds a delete-guard trigger on
-- events. Neither table was previously part of the tracked migration
-- chain — they only existed in foundry-console/SCHEMA.sql, a doc applied
-- by hand in the Supabase SQL editor — so a clean `supabase db reset`
-- failed with "relation workspaces does not exist" before this file
-- existed. This migration is byte-for-byte the workspaces/events subset
-- of SCHEMA.sql: idempotent (`if not exists` / `drop policy if exists`),
-- so re-running it against a database where SCHEMA.sql was already
-- applied by hand is a no-op.
--
-- Only workspaces and events are included here — the routing control
-- plane does not reference sprints, friction_entries, milestones,
-- manual, or settings, and this migration must not become the place
-- those get defined; if they need tracking later, add them in their own
-- migration.

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Events (audit log — append-only, never updated or deleted)
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  actor_id uuid,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table workspaces enable row level security;
alter table events enable row level security;

revoke all on table workspaces, events from anon;
revoke all on table workspaces, events from authenticated;
grant select, insert, update, delete on table workspaces to authenticated;
grant select, insert on table events to authenticated;

drop policy if exists "anon read workspaces" on workspaces;
drop policy if exists "anon insert workspaces" on workspaces;
drop policy if exists "anon update workspaces" on workspaces;
drop policy if exists "anon read events" on events;
drop policy if exists "anon insert events" on events;

drop policy if exists "owner all workspaces" on workspaces;
drop policy if exists "owner read events" on events;
drop policy if exists "owner insert events" on events;

create policy "owner all workspaces" on workspaces
  for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');

create policy "owner read events" on events
  for select to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');

create policy "owner insert events" on events
  for insert to authenticated
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');
