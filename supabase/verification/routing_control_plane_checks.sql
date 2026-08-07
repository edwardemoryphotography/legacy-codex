-- Verification queries for the Foundry baseline, routing-control-plane
-- foundation, and hardening migrations. Run in the foundry-console SQL
-- editor AFTER applying all three, in migration order.
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

-- 3. authenticated has SELECT only after the hardening migration -- INSERT
--    and UPDATE were revoked so every write must go through
--    persist_route_atomic (expect: one SELECT row per table, nothing else).
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'authenticated'
  and table_name in ('routed_requests', 'evidence_items')
order by table_name, privilege_type;

-- 4. Owner-only policies exist. After the hardening migration revoked
--    direct INSERT/UPDATE, only the two SELECT policies remain -- the
--    four insert/update policies were dropped as dead weight (expect:
--    two policies, both cmd = SELECT, both owner-email based).
select tablename, policyname, cmd
from pg_policies
where tablename in ('routed_requests', 'evidence_items')
order by tablename, policyname;

-- 5. History immutability: this UPDATE must FAIL with
--    'routed_requests history is immutable…' (run against a real row id).
--    Run as service_role/postgres in the SQL editor -- as of the hardening
--    migration, authenticated can no longer reach this statement at all
--    (blocked earlier, at the grant level, by check 3 above). This trigger
--    is the last line of defense for direct SQL and service-role access.
-- update routed_requests set intent = 'tampered' where id = '<some-id>';

-- 6. Evidence reality gate: this INSERT must FAIL the
--    evidence_verified_requires_reality constraint. Same as (5): run as
--    service_role/postgres, since authenticated has no INSERT grant here
--    either.
-- insert into evidence_items (workspace_id, kind, status, claim)
-- values ('<workspace-id>', 'custom', 'verified', 'no observation attached');

-- 7. events remains append-only (expect: authenticated has SELECT and INSERT
--    only — unchanged from foundry-console/SCHEMA.sql).
select privilege_type
from information_schema.role_table_grants
where grantee = 'authenticated' and table_name = 'events'
order by privilege_type;

-- 8. Delete guards cover all canonical history, including parent cascades
--    and service-role statements (expect: three enabled BEFORE DELETE triggers).
-- 8b. events also has a BEFORE UPDATE guard, since it has no legitimate
--     update path at all (expect: one enabled BEFORE UPDATE trigger).
select event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_name in (
  'events_prevent_delete',
  'events_prevent_update',
  'routed_requests_prevent_delete',
  'evidence_items_prevent_delete'
)
order by event_object_table, event_manipulation;

-- 9. No existing correction crosses a workspace or self-references
--    (expect: zero rows).
select child.id, child.workspace_id, child.supersedes_request_id,
       parent.workspace_id as parent_workspace_id
from routed_requests child
join routed_requests parent on parent.id = child.supersedes_request_id
where child.workspace_id <> parent.workspace_id or child.id = parent.id;

-- 10. No correction target has multiple children (expect: zero rows).
select supersedes_request_id, count(*)
from routed_requests
where supersedes_request_id is not null
group by supersedes_request_id
having count(*) > 1;

-- 11. No evidence link crosses a workspace (expect: zero rows).
select evidence_items.id, evidence_items.workspace_id,
       routed_requests.workspace_id as route_workspace_id
from evidence_items
join routed_requests on routed_requests.id = evidence_items.routed_request_id
where evidence_items.workspace_id <> routed_requests.workspace_id;

-- 12. Existing evidence satisfies strengthened reality rules (expect: zero rows).
select id, status, source, observed_at, provenance,
       routed_request_id, action_id
from evidence_items
where nullif(btrim(claim), '') is null
   or (source is not null and nullif(btrim(source), '') is null)
   or observed_at > now() + interval '5 minutes'
   or (
     status = 'verified' and (
       nullif(btrim(source), '') is null
       or observed_at is null
       or provenance not in (
         'verified', 'repository_evidence', 'runtime_evidence', 'user_confirmed'
       )
       or (routed_request_id is null and action_id is null)
     )
   );

-- 13. Idempotency keys are complete and unique (expect: zero rows).
select idempotency_key, count(*)
from routed_requests
group by idempotency_key
having idempotency_key is null or count(*) > 1;

-- 14. Only service_role can execute the atomic intake RPC (expect: one row,
--     grantee service_role, privilege EXECUTE).
select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'persist_route_atomic'
order by grantee;

-- 15. Run these in a transaction and ROLLBACK after substituting real IDs:
--     a) deleting an event, route, or evidence row must fail;
--     b) deleting a workspace with history must fail through the cascade;
--     c) a second correction of the same target must fail;
--     d) a correction in a different workspace must fail;
--     e) changing route provenance/action/linkage must fail;
--     f) changing a verified evidence source/claim/link must fail;
--     g) pending -> verified with blank/future/unlinked evidence must fail;
--     h) the same persist_route_atomic idempotency key must return replayed=true
--        without adding a second route, event, or evidence row.
