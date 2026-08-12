-- Follow-up to 20260808000000_owner_select_actions_policy.sql.
-- The RLS policy alone was insufficient: the authenticated role also lacked
-- the table-level GRANT, so the routing page's linked-action enrichment
-- received 42501 (permission denied for table actions).
grant select on table actions to authenticated;
