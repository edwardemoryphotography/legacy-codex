-- Routing Control Plane — routed_requests + evidence_items.
-- Forward-only. Targets the foundry-console Supabase project
-- (pkydkbuodikttfeawqsw), the same database that already holds the Foundry
-- tables defined in foundry-console/SCHEMA.sql (workspaces, events, …) and
-- the actions table created by codex-system-architecture migration
-- 20260520120000_unified_actions_and_session_start.sql.
--
-- Canonical ownership decisions this migration implements:
--   * project/workspace registry  -> existing workspaces table (unchanged)
--   * mission/work item           -> existing actions table (unchanged)
--   * append-only event history   -> existing events table (unchanged)
--   * routed request              -> routed_requests (new, this file)
--   * evidence                    -> evidence_items (new, this file)
-- No parallel task, project, audit-log, or evidence system is created.
--
-- Security model matches foundry-console/SCHEMA.sql: owner-only RLS keyed on
-- the authenticated owner email, with anon fully revoked. Grants deliberately
-- exclude DELETE so history cannot be destroyed from any client. Corrections
-- append a new routed_requests row referencing the original via
-- supersedes_request_id; a trigger blocks mutation of the original record's
-- routing facts.

-- ─── routed_requests ───────────────────────────────────────────────────
create table if not exists routed_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  -- Linked mission/work item (canonical: actions). FK added conditionally
  -- below because actions is created by a codex-system-architecture
  -- migration and may be absent on a fresh local stack.
  action_id uuid,
  -- Correction chain: a correction inserts a NEW row pointing at the row it
  -- supersedes. The original is never rewritten.
  supersedes_request_id uuid references routed_requests(id),
  -- The owner's original ask, preserved verbatim.
  intent text not null,
  task_type text not null,
  execution_lane text not null check (execution_lane in
    ('execution', 'research', 'architecture', 'deployment', 'documentation', 'system_state', 'override')),
  selected_agent text not null,
  repository text not null,
  repository_path text,
  risk text not null check (risk in ('low', 'medium', 'high', 'critical')),
  sensitivity text not null check (sensitivity in ('public', 'internal', 'private', 'restricted')),
  required_evidence text not null,
  rationale text not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 100),
  status text not null default 'proposed' check (status in
    ('proposed', 'confirmed', 'corrected', 'superseded', 'rejected', 'blocked_policy')),
  -- What produced the route. doctrine_fallback marks the deterministic
  -- no-model path so degraded routing is always labeled honestly.
  route_source text not null check (route_source in ('model', 'doctrine_fallback', 'user')),
  provenance text not null default 'inference' check (provenance in
    ('verified', 'repository_evidence', 'runtime_evidence', 'user_confirmed', 'inference', 'concept', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_routed_requests_workspace on routed_requests(workspace_id, created_at desc);
create index if not exists idx_routed_requests_status on routed_requests(status);
create index if not exists idx_routed_requests_supersedes on routed_requests(supersedes_request_id)
  where supersedes_request_id is not null;

-- History protection: routing facts on a persisted request are immutable.
-- Only lifecycle fields (status, action_id linkage, provenance, updated_at)
-- may change. Corrections must insert a new row.
create or replace function routed_requests_protect_history()
returns trigger
language plpgsql
as $$
begin
  if old.intent is distinct from new.intent
    or old.workspace_id is distinct from new.workspace_id
    or old.task_type is distinct from new.task_type
    or old.execution_lane is distinct from new.execution_lane
    or old.selected_agent is distinct from new.selected_agent
    or old.repository is distinct from new.repository
    or old.repository_path is distinct from new.repository_path
    or old.risk is distinct from new.risk
    or old.sensitivity is distinct from new.sensitivity
    or old.required_evidence is distinct from new.required_evidence
    or old.rationale is distinct from new.rationale
    or old.confidence is distinct from new.confidence
    or old.route_source is distinct from new.route_source
    or old.supersedes_request_id is distinct from new.supersedes_request_id
    or old.created_at is distinct from new.created_at
  then
    raise exception 'routed_requests history is immutable — corrections must insert a new row that supersedes this one';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists routed_requests_immutable on routed_requests;
create trigger routed_requests_immutable
  before update on routed_requests
  for each row execute function routed_requests_protect_history();

-- ─── evidence_items ────────────────────────────────────────────────────
-- Extends the evidence vocabulary proposed in the (unmerged) Mission Loop
-- branch — kind + verified/unverified/conflict/stale — with the explicit
-- 'pending' state every new route starts in. Nothing is verified by default.
create table if not exists evidence_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  routed_request_id uuid references routed_requests(id),
  action_id uuid,
  kind text not null check (kind in
    ('merged_pr', 'live_deployment', 'published_artifact', 'confirmed_action', 'test_run', 'custom')),
  status text not null default 'pending' check (status in
    ('pending', 'verified', 'unverified', 'conflict', 'stale')),
  -- The claim this evidence would substantiate (e.g. the mission finish line).
  claim text not null,
  -- Where the evidence was observed (URL, PR number, CI run…). Null until
  -- something real was observed.
  source text,
  observed_at timestamptz,
  provenance text not null default 'unknown' check (provenance in
    ('verified', 'repository_evidence', 'runtime_evidence', 'user_confirmed', 'inference', 'concept', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Reality gate: a row cannot claim verified status without a concrete
  -- observation (source + observed_at) and an evidence-grade provenance.
  constraint evidence_verified_requires_reality check (
    status <> 'verified' or (
      source is not null
      and observed_at is not null
      and provenance in ('verified', 'repository_evidence', 'runtime_evidence', 'user_confirmed')
    )
  )
);

create index if not exists idx_evidence_items_workspace on evidence_items(workspace_id, created_at desc);
create index if not exists idx_evidence_items_request on evidence_items(routed_request_id)
  where routed_request_id is not null;
create index if not exists idx_evidence_items_status on evidence_items(status);

create or replace function evidence_items_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists evidence_items_touch on evidence_items;
create trigger evidence_items_touch
  before update on evidence_items
  for each row execute function evidence_items_touch_updated_at();

-- ─── conditional FK to actions (created by codex-system-architecture) ──
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'actions'
  ) then
    if not exists (
      select 1 from information_schema.table_constraints
      where constraint_name = 'routed_requests_action_fk'
    ) then
      alter table routed_requests
        add constraint routed_requests_action_fk
        foreign key (action_id) references actions(id) on delete set null;
    end if;
    if not exists (
      select 1 from information_schema.table_constraints
      where constraint_name = 'evidence_items_action_fk'
    ) then
      alter table evidence_items
        add constraint evidence_items_action_fk
        foreign key (action_id) references actions(id) on delete set null;
    end if;
  end if;
end;
$$;

-- ─── Row Level Security (mirrors foundry-console/SCHEMA.sql exactly) ───
alter table routed_requests enable row level security;
alter table evidence_items enable row level security;

-- Defense in depth: anon can never touch these tables; authenticated gets
-- no DELETE anywhere, so history survives every client.
revoke all on table routed_requests, evidence_items from anon;
revoke all on table routed_requests, evidence_items from authenticated;
grant select, insert, update on table routed_requests, evidence_items to authenticated;

drop policy if exists "owner select routed_requests" on routed_requests;
drop policy if exists "owner insert routed_requests" on routed_requests;
drop policy if exists "owner update routed_requests" on routed_requests;
drop policy if exists "owner select evidence_items" on evidence_items;
drop policy if exists "owner insert evidence_items" on evidence_items;
drop policy if exists "owner update evidence_items" on evidence_items;

create policy "owner select routed_requests" on routed_requests
  for select to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');

create policy "owner insert routed_requests" on routed_requests
  for insert to authenticated
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');

create policy "owner update routed_requests" on routed_requests
  for update to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');

create policy "owner select evidence_items" on evidence_items
  for select to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');

create policy "owner insert evidence_items" on evidence_items
  for insert to authenticated
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');

create policy "owner update evidence_items" on evidence_items
  for update to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');

-- Events for the routing control plane are appended to the EXISTING events
-- table (foundry-console/SCHEMA.sql) using action values:
--   'route.persisted'  — a routed_requests row was created
--   'route.corrected'  — a correction row superseded an earlier route
--   'route.action_linked' — a routed request was linked to an actions row
--   'evidence.recorded'   — an evidence_items row changed status
-- No schema change to events is made or required.
