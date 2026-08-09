-- Live verification of PR #58 found a second integrity gap beyond the
-- cross-user SELECT policy: legacy default grants exposed evidence_snapshots
-- to the public anon role and gave authenticated clients unrestricted UPDATE.
-- RLS controls rows, not which columns an allowed UPDATE may change.
--
-- This migration matches the first verified live hardening step exactly:
-- remove public read/update access, keep authenticated reads, and allow
-- authenticated clients to update mission_id only. A follow-up migration
-- removes the remaining legacy default privileges.
revoke select on table public.evidence_snapshots from anon;
revoke update on table public.evidence_snapshots from anon;
revoke update on table public.evidence_snapshots from authenticated;
grant select on table public.evidence_snapshots to authenticated;
grant update (mission_id) on table public.evidence_snapshots to authenticated;

drop policy if exists "evidence_snapshots authenticated read" on public.evidence_snapshots;
create policy "evidence_snapshots authenticated read" on public.evidence_snapshots
  for select
  to authenticated
  using (
    mission_id is null or exists (
      select 1 from public.missions
      where missions.id = evidence_snapshots.mission_id
      and missions.user_id = auth.uid()
    )
  );

drop policy if exists "evidence_snapshots owner update" on public.evidence_snapshots;
create policy "evidence_snapshots owner update" on public.evidence_snapshots
  for update
  to authenticated
  using (
    mission_id is null or exists (
      select 1 from public.missions
      where missions.id = evidence_snapshots.mission_id
      and missions.user_id = auth.uid()
    )
  ) with check (
    mission_id is null or exists (
      select 1 from public.missions
      where missions.id = evidence_snapshots.mission_id
      and missions.user_id = auth.uid()
    )
  );
