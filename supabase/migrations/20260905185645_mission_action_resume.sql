-- Add a private mission-linked action path to the existing canonical table.
-- Existing unlinked builder actions retain their owner-only read policy.
alter table public.actions
  add column mission_id uuid references public.missions(id),
  add column resume_note text,
  add column updated_at timestamptz not null default now();

alter table public.actions add constraint mission_action_title_required
  check (mission_id is null or length(btrim(action_title)) between 1 and 2000);
create index actions_mission_id_idx on public.actions(mission_id);
create unique index actions_one_next_per_mission on public.actions(mission_id)
  where mission_id is not null and is_next_action and status <> 'DONE';

alter table public.actions enable row level security;
alter policy "owner select actions" on public.actions
  using (mission_id is null and lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');

create policy "mission action owner select" on public.actions for select to authenticated
  using (exists (select 1 from public.missions m where m.id = mission_id and m.user_id = (select auth.uid())));
create policy "mission action owner insert" on public.actions for insert to authenticated
  with check (mission_id is not null and exists (select 1 from public.missions m where m.id = mission_id and m.user_id = (select auth.uid())));
create policy "mission action owner update" on public.actions for update to authenticated
  using (exists (select 1 from public.missions m where m.id = mission_id and m.user_id = (select auth.uid())))
  with check (mission_id is not null and exists (select 1 from public.missions m where m.id = mission_id and m.user_id = (select auth.uid())));
grant select, insert, update on public.actions to authenticated;

create function public.mission_action_touch() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old.mission_id is distinct from new.mission_id then
    raise exception 'An action cannot be moved to another mission';
  end if;
  new.updated_at = clock_timestamp();
  return new;
end;
$$;
revoke all on function public.mission_action_touch() from public, anon, authenticated;
create trigger mission_action_touch before update on public.actions
  for each row execute function public.mission_action_touch();
