-- Fixes a gap in 0001_mission_loop.sql: evidence_snapshots' read policy was
-- auth.role() = 'authenticated', which lets any signed-in session (including
-- this app's anonymous sign-ins) read every user's evidence, not just their
-- own. Scope it the same way the update policy on this table already is:
-- snapshots that are either unlinked (mission_id is null) or linked to a
-- mission the caller owns.
drop policy if exists "evidence_snapshots authenticated read" on evidence_snapshots;
create policy "evidence_snapshots authenticated read" on evidence_snapshots
  for select using (
    mission_id is null or exists (
      select 1 from missions
      where missions.id = evidence_snapshots.mission_id
      and missions.user_id = auth.uid()
    )
  );
