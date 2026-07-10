-- The Foundry Console — Supabase Schema (link-access edition)
-- No user sign-in: anyone with the app link (and thus the anon key) can
-- read and write workspace data. The events table stays append-only.
-- Apply this in the Supabase SQL editor.

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
-- Link-access model: the anon role can select/insert/update everything
-- except events, which is select + insert only (append-only, enforced at
-- the database level — the UI also never exposes edit/delete).
-- No delete policies exist on any table, so nothing can be deleted via the
-- anon key.
-- ---------------------------------------------------------------------------

alter table workspaces enable row level security;
alter table sprints enable row level security;
alter table friction_entries enable row level security;
alter table milestones enable row level security;
alter table manual enable row level security;
alter table settings enable row level security;
alter table events enable row level security;

-- Workspaces
create policy "anon read workspaces" on workspaces for select using (true);
create policy "anon insert workspaces" on workspaces for insert with check (true);
create policy "anon update workspaces" on workspaces for update using (true);

-- Sprints
create policy "anon read sprints" on sprints for select using (true);
create policy "anon insert sprints" on sprints for insert with check (true);
create policy "anon update sprints" on sprints for update using (true);

-- Friction entries
create policy "anon read friction" on friction_entries for select using (true);
create policy "anon insert friction" on friction_entries for insert with check (true);
create policy "anon update friction" on friction_entries for update using (true);

-- Milestones
create policy "anon read milestones" on milestones for select using (true);
create policy "anon insert milestones" on milestones for insert with check (true);
create policy "anon update milestones" on milestones for update using (true);

-- Manual
create policy "anon read manual" on manual for select using (true);
create policy "anon insert manual" on manual for insert with check (true);
create policy "anon update manual" on manual for update using (true);

-- Settings
create policy "anon read settings" on settings for select using (true);
create policy "anon insert settings" on settings for insert with check (true);
create policy "anon update settings" on settings for update using (true);

-- Events: append-only. Select + insert, no update, no delete.
create policy "anon read events" on events for select using (true);
create policy "anon insert events" on events for insert with check (true);
