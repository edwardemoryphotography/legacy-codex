-- The Foundry Console — Supabase Schema Reference
-- This file documents the expected schema. Apply via Supabase SQL editor.

-- Workspaces
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Workspace members (links auth.users to workspaces with role)
create table if not exists workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  unique(workspace_id, user_id)
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
  created_by uuid references auth.users(id),
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

-- Manual pages (admin-editable documentation)
create table if not exists manual (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  content text,
  version integer not null default 1,
  updated_by uuid references auth.users(id),
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

-- Events (audit log — append-only)
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- RLS policies (examples — adjust to your needs)
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table sprints enable row level security;
alter table friction_entries enable row level security;
alter table milestones enable row level security;
alter table manual enable row level security;
alter table settings enable row level security;
alter table events enable row level security;

-- workspace_members: users can see their own memberships
create policy "Users see own memberships" on workspace_members
  for select using (auth.uid() = user_id);

-- workspaces: users can see workspaces they belong to
create policy "Members see workspace" on workspaces
  for select using (
    exists (
      select 1 from workspace_members
      where workspace_members.workspace_id = workspaces.id
        and workspace_members.user_id = auth.uid()
    )
  );

-- sprints: workspace members can CRUD
create policy "Members manage sprints" on sprints
  for all using (
    exists (
      select 1 from workspace_members
      where workspace_members.workspace_id = sprints.workspace_id
        and workspace_members.user_id = auth.uid()
    )
  );

-- friction_entries: workspace members can CRUD
create policy "Members manage friction" on friction_entries
  for all using (
    exists (
      select 1 from workspace_members
      where workspace_members.workspace_id = friction_entries.workspace_id
        and workspace_members.user_id = auth.uid()
    )
  );

-- milestones: workspace members can CRUD
create policy "Members manage milestones" on milestones
  for all using (
    exists (
      select 1 from workspace_members
      where workspace_members.workspace_id = milestones.workspace_id
        and workspace_members.user_id = auth.uid()
    )
  );

-- manual: admins can update, members can read
create policy "Members read manual" on manual
  for select using (
    exists (
      select 1 from workspace_members
      where workspace_members.workspace_id = manual.workspace_id
        and workspace_members.user_id = auth.uid()
    )
  );
create policy "Admins write manual" on manual
  for all using (
    exists (
      select 1 from workspace_members
      where workspace_members.workspace_id = manual.workspace_id
        and workspace_members.user_id = auth.uid()
        and workspace_members.role = 'admin'
    )
  );

-- settings: admins can manage, members can read
create policy "Members read settings" on settings
  for select using (
    exists (
      select 1 from workspace_members
      where workspace_members.workspace_id = settings.workspace_id
        and workspace_members.user_id = auth.uid()
    )
  );
create policy "Admins write settings" on settings
  for all using (
    exists (
      select 1 from workspace_members
      where workspace_members.workspace_id = settings.workspace_id
        and workspace_members.user_id = auth.uid()
        and workspace_members.role = 'admin'
    )
  );

-- events: members can read, anyone can insert (via function), no update/delete
create policy "Members read events" on events
  for select using (
    exists (
      select 1 from workspace_members
      where workspace_members.workspace_id = events.workspace_id
        and workspace_members.user_id = auth.uid()
    )
  );
create policy "Members insert events" on events
  for insert with check (
    exists (
      select 1 from workspace_members
      where workspace_members.workspace_id = events.workspace_id
        and workspace_members.user_id = auth.uid()
    )
  );
