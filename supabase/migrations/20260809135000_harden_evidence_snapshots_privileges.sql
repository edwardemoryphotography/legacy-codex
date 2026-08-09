-- Live verification of PR #58 found a second integrity gap beyond the
-- cross-user SELECT policy: this project's legacy default table grants gave
-- anon/authenticated full table privileges, while the intended client contract
-- only needs authenticated reads plus mission_id linking. RLS alone does not
-- restrict which columns an allowed UPDATE may change.
--
-- Keep service_role ownership of evidence truth. Public anon gets no table
-- access. Signed-in clients may SELECT eligible rows and UPDATE mission_id only.
revoke all on table evidence_snapshots from anon, authenticated;
grant select on table evidence_snapshots to authenticated;
grant update (mission_id) on table evidence_snapshots to authenticated;

drop policy if exists "evidence_snapshots authenticated read" on evidence_snapshots;
create policy "evidence_snapshots authenticated read" on evidence_snapshots
  for select
  to authenticated
  using (
    mission_id is null or exists (
      select 1 from missions
      where missions.id = evidence_snapshots.mission_id
      and missions.user_id = auth.uid()
    )
  );

drop policy if exists "evidence_snapshots owner update" on evidence_snapshots;
create policy "evidence_snapshots owner update" on evidence_snapshots
  for update
  to authenticated
  using (
    mission_id is null or exists (
      select 1 from missions
      where missions.id = evidence_snapshots.mission_id
      and missions.user_id = auth.uid()
    )
  ) with check (
    mission_id is null or exists (
      select 1 from missions
      where missions.id = evidence_snapshots.mission_id
      and missions.user_id = auth.uid()
    )
  );
