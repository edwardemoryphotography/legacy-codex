-- Verification queries for supabase/migrations/20260804010000_routing_control_plane.sql
-- Run in the foundry-console SQL editor AFTER applying the migration.
-- Status of these checks in Lane A: PENDING — live database access was not
-- available to the implementing session, so none of these results are
-- claimed as verified. Each query states its expected result.

-- 1. RLS is enabled on both new tables (expect: two rows, both true).
select relname, relrowsecurity
from pg_class
where relname in ('routed_requests', 'evidence_items');

-- 2. anon has zero privileges on the new tables (expect: zero rows).
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon'
  and table_name in ('routed_requests', 'evidence_items');

-- 3. authenticated has select/insert/update but NOT delete (expect: no DELETE row).
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'authenticated'
  and table_name in ('routed_requests', 'evidence_items')
order by table_name, privilege_type;

-- 4. Owner-only policies exist (expect: six policies, all owner-email based).
select tablename, policyname, cmd
from pg_policies
where tablename in ('routed_requests', 'evidence_items')
order by tablename, policyname;

-- 5. History immutability: this UPDATE must FAIL with
--    'routed_requests history is immutable…' (run against a real row id).
-- update routed_requests set intent = 'tampered' where id = '<some-id>';

-- 6. Evidence reality gate: this INSERT must FAIL the
--    evidence_verified_requires_reality constraint.
-- insert into evidence_items (workspace_id, kind, status, claim)
-- values ('<workspace-id>', 'custom', 'verified', 'no observation attached');

-- 7. events remains append-only (expect: authenticated has SELECT and INSERT
--    only — unchanged from foundry-console/SCHEMA.sql).
select privilege_type
from information_schema.role_table_grants
where grantee = 'authenticated' and table_name = 'events'
order by privilege_type;
