-- Match SavedActions: every mission-linked non-DONE row is unfinished,
-- regardless of the builder-facing is_next_action flag. Preserve all rows.
-- Building the stronger index first fails safely if duplicates need review;
-- it never silently deletes or completes the user's work.
create unique index actions_one_unfinished_per_mission on public.actions(mission_id)
  where mission_id is not null and status <> 'DONE';
drop index public.actions_one_next_per_mission;
