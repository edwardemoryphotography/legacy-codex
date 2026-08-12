-- Complete the least-privilege cleanup discovered during live PR #58
-- verification. These legacy default table grants are not required by the
-- client contract. service_role remains untouched and continues to own
-- evidence ingestion; authenticated clients keep SELECT plus column-scoped
-- UPDATE(mission_id) from the prior migration.
revoke insert, delete, truncate, references, trigger
  on table public.evidence_snapshots from anon;
revoke insert, delete, truncate, references, trigger
  on table public.evidence_snapshots from authenticated;
