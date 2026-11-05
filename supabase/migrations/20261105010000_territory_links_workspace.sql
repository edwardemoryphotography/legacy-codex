-- Path 2: saved relationships between missions and first-class territory
-- entities, plus a real owner-scoped active-state/log. No inferred edges, no
-- localStorage truth, no admin bypass.

create table if not exists public.territory_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  from_kind text not null check (from_kind in ('mission', 'territory_node')),
  from_id uuid not null,
  to_kind text not null check (to_kind in ('mission', 'territory_node')),
  to_id uuid not null,
  relation text not null check (char_length(btrim(relation)) between 1 and 80),
  provenance text not null default 'person' check (provenance in ('person', 'mission_event', 'import')),
  created_at timestamptz not null default now(),
  constraint territory_links_distinct_endpoints check (from_kind <> to_kind or from_id <> to_id)
);
create unique index if not exists territory_links_unique
  on public.territory_links (user_id, from_kind, from_id, to_kind, to_id, relation);
create index if not exists territory_links_user_idx on public.territory_links(user_id);
create index if not exists territory_links_from_idx on public.territory_links(user_id, from_kind, from_id);
create index if not exists territory_links_to_idx on public.territory_links(user_id, to_kind, to_id);

alter table public.territory_links enable row level security;
drop policy if exists "territory link owner select" on public.territory_links;
create policy "territory link owner select" on public.territory_links
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "territory link owner insert" on public.territory_links;
create policy "territory link owner insert" on public.territory_links
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "territory link owner delete" on public.territory_links;
create policy "territory link owner delete" on public.territory_links
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.territory_links to authenticated;

create or replace function public.territory_link_valid() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.from_kind = 'mission' then
    if not exists (select 1 from public.missions m where m.id = new.from_id and m.user_id = new.user_id) then
      raise exception 'The source mission is not owned by this account' using errcode = 'P0001';
    end if;
  elsif not exists (select 1 from public.territory_nodes n where n.id = new.from_id and n.user_id = new.user_id) then
    raise exception 'The source territory entity is not owned by this account' using errcode = 'P0001';
  end if;
  if new.to_kind = 'mission' then
    if not exists (select 1 from public.missions m where m.id = new.to_id and m.user_id = new.user_id) then
      raise exception 'The target mission is not owned by this account' using errcode = 'P0001';
    end if;
  elsif not exists (select 1 from public.territory_nodes n where n.id = new.to_id and n.user_id = new.user_id) then
    raise exception 'The target territory entity is not owned by this account' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.territory_link_valid() from public, anon, authenticated;
drop trigger if exists territory_link_valid on public.territory_links;
create trigger territory_link_valid before insert or update on public.territory_links
  for each row execute function public.territory_link_valid();

create table if not exists public.territory_state (
  user_id uuid primary key,
  active_project text,
  energy text check (energy in ('crashed', 'low', 'steady', 'flow')),
  next_action text,
  updated_at timestamptz not null default now()
);
alter table public.territory_state enable row level security;
drop policy if exists "territory state owner select" on public.territory_state;
create policy "territory state owner select" on public.territory_state
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "territory state owner insert" on public.territory_state;
create policy "territory state owner insert" on public.territory_state
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "territory state owner update" on public.territory_state;
create policy "territory state owner update" on public.territory_state
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update on public.territory_state to authenticated;

create table if not exists public.territory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null check (type in ('state_saved', 'log_entry', 'link_created', 'link_removed')),
  detail text not null default '' check (char_length(detail) <= 4000),
  idempotency_key text,
  created_at timestamptz not null default now()
);
create unique index if not exists territory_events_idempotency
  on public.territory_events (user_id, idempotency_key) where idempotency_key is not null;
create index if not exists territory_events_user_created_idx
  on public.territory_events (user_id, created_at desc);
alter table public.territory_events enable row level security;
drop policy if exists "territory event owner select" on public.territory_events;
create policy "territory event owner select" on public.territory_events
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "territory event owner insert" on public.territory_events;
create policy "territory event owner insert" on public.territory_events
  for insert to authenticated with check (user_id = (select auth.uid()));
grant select, insert on public.territory_events to authenticated;

create or replace function public.territory_state_touch() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;
revoke all on function public.territory_state_touch() from public, anon, authenticated;
drop trigger if exists territory_state_touch on public.territory_state;
create trigger territory_state_touch before update on public.territory_state
  for each row execute function public.territory_state_touch();
