-- First-class non-mission Territory entities. Missions remain canonical work;
-- this table names the projects, doctrine and constraints those missions live
-- inside. It is not an action system and it does not link entities yet.
create table if not exists public.territory_nodes (
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

create index if not exists territory_nodes_user_idx on public.territory_nodes(user_id);

alter table public.territory_nodes enable row level security;

drop policy if exists "territory node owner select" on public.territory_nodes;
create policy "territory node owner select" on public.territory_nodes
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "territory node owner insert" on public.territory_nodes;
create policy "territory node owner insert" on public.territory_nodes
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "territory node owner update" on public.territory_nodes;
create policy "territory node owner update" on public.territory_nodes
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "territory node owner delete" on public.territory_nodes;
create policy "territory node owner delete" on public.territory_nodes
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.territory_nodes to authenticated;

create or replace function public.territory_node_touch() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old.user_id is distinct from new.user_id then
    raise exception 'A territory node cannot be moved to another account';
  end if;
  new.updated_at = clock_timestamp();
  return new;
end;
$$;
revoke all on function public.territory_node_touch() from public, anon, authenticated;

drop trigger if exists territory_node_touch on public.territory_nodes;
create trigger territory_node_touch before update on public.territory_nodes
  for each row execute function public.territory_node_touch();
