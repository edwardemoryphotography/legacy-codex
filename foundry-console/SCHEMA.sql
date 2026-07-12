-- The Foundry Console — Supabase Schema (owner-authenticated edition)
-- Access is restricted to the authenticated owner account at the database layer.
-- Apply this in the Supabase SQL editor after enabling Email OTP authentication.

-- Workspaces
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Sprints
create table if not exists sprints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  goal text,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'cancelled')),
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Friction entries
create table if not exists friction_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  description text,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'resolved', 'wontfix')),
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Milestones
create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Manual pages (editable documentation with version counter)
create table if not exists manual (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  content text,
  version integer not null default 1,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Workspace settings
create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade unique,
  kill_switch_ai boolean not null default false,
  pii_warning_enabled boolean not null default false,
  updated_at timestamptz not null default now()
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

-- ---------------------------------------------------------------------------
-- Row Level Security
-- The public anon role receives no data policies. Only the authenticated owner
-- email can read or write records. Events remain append-only.
-- ---------------------------------------------------------------------------

alter table workspaces enable row level security;
alter table sprints enable row level security;
alter table friction_entries enable row level security;
alter table milestones enable row level security;
alter table manual enable row level security;
alter table settings enable row level security;
alter table events enable row level security;

-- Defense in depth: anonymous clients cannot discover or call these tables even
-- if a permissive policy is added accidentally later. Authenticated requests
-- still require the owner-email RLS checks below.
revoke all on table workspaces, sprints, friction_entries, milestones, manual, settings, events from anon;
grant select, insert, update, delete on table workspaces, sprints, friction_entries, milestones, manual, settings to authenticated;
grant select, insert on table events to authenticated;

-- Remove the former public link-access policies if this schema is reapplied.
drop policy if exists "anon read workspaces" on workspaces;
drop policy if exists "anon insert workspaces" on workspaces;
drop policy if exists "anon update workspaces" on workspaces;
drop policy if exists "anon read sprints" on sprints;
drop policy if exists "anon insert sprints" on sprints;
drop policy if exists "anon update sprints" on sprints;
drop policy if exists "anon read friction" on friction_entries;
drop policy if exists "anon insert friction" on friction_entries;
drop policy if exists "anon update friction" on friction_entries;
drop policy if exists "anon read milestones" on milestones;
drop policy if exists "anon insert milestones" on milestones;
drop policy if exists "anon update milestones" on milestones;
drop policy if exists "anon read manual" on manual;
drop policy if exists "anon insert manual" on manual;
drop policy if exists "anon update manual" on manual;
drop policy if exists "anon read settings" on settings;
drop policy if exists "anon insert settings" on settings;
drop policy if exists "anon update settings" on settings;
drop policy if exists "anon read events" on events;
drop policy if exists "anon insert events" on events;

-- Idempotently replace owner policies.
drop policy if exists "owner all workspaces" on workspaces;
drop policy if exists "owner all sprints" on sprints;
drop policy if exists "owner all friction" on friction_entries;
drop policy if exists "owner all milestones" on milestones;
drop policy if exists "owner all manual" on manual;
drop policy if exists "owner all settings" on settings;
drop policy if exists "owner read events" on events;
drop policy if exists "owner insert events" on events;

create policy "owner all workspaces" on workspaces
  for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');

create policy "owner all sprints" on sprints
  for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');

create policy "owner all friction" on friction_entries
  for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');

create policy "owner all milestones" on milestones
  for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');

create policy "owner all manual" on manual
  for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');

create policy "owner all settings" on settings
  for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');

create policy "owner read events" on events
  for select to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');

create policy "owner insert events" on events
  for insert to authenticated
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');
