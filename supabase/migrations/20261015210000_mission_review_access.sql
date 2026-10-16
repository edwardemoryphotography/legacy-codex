-- Explicit administrator grants only. Anonymous sign-in is not a grant.
create table public.mission_review_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  remaining_requests integer not null check (remaining_requests between 0 and 20),
  last_request_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.mission_review_access enable row level security;
revoke all on public.mission_review_access from anon, authenticated;
grant select on public.mission_review_access to authenticated;
create policy read_own_review_access on public.mission_review_access
  for select to authenticated using ((select auth.uid()) = user_id);

create schema if not exists private;
-- The definer performs one bounded decrement, never grants or renews access.
create function private.reserve_mission_review() returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return false; end if;
  update public.mission_review_access
     set remaining_requests = remaining_requests - 1, last_request_at = now()
   where user_id = auth.uid() and expires_at > now() and remaining_requests > 0
     and (last_request_at is null or last_request_at <= now() - interval '60 seconds');
  return found;
end;
$$;
revoke all on function private.reserve_mission_review() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.reserve_mission_review() to authenticated;
create function public.reserve_mission_review() returns boolean
language sql security invoker set search_path = '' as $$
  select private.reserve_mission_review();
$$;
revoke all on function public.reserve_mission_review() from public, anon;
grant execute on function public.reserve_mission_review() to authenticated;
