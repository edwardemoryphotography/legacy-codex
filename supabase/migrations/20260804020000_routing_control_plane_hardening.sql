-- Routing Control Plane hardening (forward-only).
--
-- The foundation migration may already be applied.  Do not rewrite it in
-- place: this migration reconciles existing installations by strengthening
-- history, correction, evidence, and transaction invariants.

-- Every accepted submission has a stable replay key and records the owner's
-- explicit confirmations.  Existing rows receive unique backfill keys.
alter table routed_requests
  add column if not exists idempotency_key uuid,
  add column if not exists correction_reason text,
  add column if not exists confirmation_destructive boolean not null default false,
  add column if not exists confirmation_protected_operation boolean not null default false,
  add column if not exists confirmation_public_exposure boolean not null default false;

update routed_requests
set idempotency_key = gen_random_uuid()
where idempotency_key is null;

alter table routed_requests
  alter column idempotency_key set not null;

create unique index if not exists routed_requests_idempotency_key_unique
  on routed_requests(idempotency_key);
create unique index if not exists routed_requests_one_correction_per_target
  on routed_requests(supersedes_request_id)
  where supersedes_request_id is not null;
create unique index if not exists routed_requests_id_workspace_unique
  on routed_requests(id, workspace_id);

alter table routed_requests
  drop constraint if exists routed_requests_not_self_superseding;
alter table routed_requests
  add constraint routed_requests_not_self_superseding
  check (supersedes_request_id is null or supersedes_request_id <> id) not valid;

alter table routed_requests
  drop constraint if exists routed_requests_correction_reason_required;
alter table routed_requests
  add constraint routed_requests_correction_reason_required
  check (
    supersedes_request_id is null
    or nullif(btrim(correction_reason), '') is not null
  ) not valid;

alter table routed_requests
  drop constraint if exists routed_requests_nonblank_facts;
alter table routed_requests
  add constraint routed_requests_nonblank_facts
  check (
    nullif(btrim(intent), '') is not null
    and nullif(btrim(repository), '') is not null
    and nullif(btrim(selected_agent), '') is not null
    and nullif(btrim(required_evidence), '') is not null
    and nullif(btrim(rationale), '') is not null
  ) not valid;

-- A correction must belong to the same workspace as its target.  NOT VALID
-- avoids pretending historical rows were checked; new writes are checked and
-- the verification script below identifies any rows that need reconciliation.
alter table routed_requests
  drop constraint if exists routed_requests_supersedes_same_workspace_fk;
alter table routed_requests
  add constraint routed_requests_supersedes_same_workspace_fk
  foreign key (supersedes_request_id, workspace_id)
  references routed_requests(id, workspace_id)
  on delete restrict
  not valid;

alter table evidence_items
  drop constraint if exists evidence_items_request_same_workspace_fk;
alter table evidence_items
  add constraint evidence_items_request_same_workspace_fk
  foreign key (routed_request_id, workspace_id)
  references routed_requests(id, workspace_id)
  on delete restrict
  not valid;

alter table evidence_items
  drop constraint if exists evidence_items_nonblank_claim;
alter table evidence_items
  add constraint evidence_items_nonblank_claim
  check (nullif(btrim(claim), '') is not null) not valid;

alter table evidence_items
  drop constraint if exists evidence_items_source_nonblank;
alter table evidence_items
  add constraint evidence_items_source_nonblank
  check (source is null or nullif(btrim(source), '') is not null) not valid;

alter table evidence_items
  drop constraint if exists evidence_items_observation_not_future;
alter table evidence_items
  add constraint evidence_items_observation_not_future
  check (observed_at is null or observed_at <= now() + interval '5 minutes') not valid;

alter table evidence_items
  drop constraint if exists evidence_items_verified_linked;
alter table evidence_items
  add constraint evidence_items_verified_linked
  check (
    status <> 'verified'
    or routed_request_id is not null
    or action_id is not null
  ) not valid;

-- Database triggers protect history even from service-role statements and from
-- ON DELETE CASCADE.  RLS/grants alone cannot provide this guarantee.
create or replace function prevent_canonical_history_delete()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception '% is append-only; delete is not permitted', tg_table_name;
end;
$$;

drop trigger if exists events_prevent_delete on events;
create trigger events_prevent_delete
  before delete on events
  for each row execute function prevent_canonical_history_delete();

-- events has no legitimate update path at all (unlike routed_requests and
-- evidence_items, which have their own protect_history triggers permitting
-- a small set of field changes): every row is insert-once. Without this,
-- a service-role or direct-SQL statement could rewrite an audit row's
-- action, metadata, or timestamp, contradicting the append-only guarantee
-- this table's own comment promises.
create or replace function prevent_events_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'events is append-only; update is not permitted';
end;
$$;

drop trigger if exists events_prevent_update on events;
create trigger events_prevent_update
  before update on events
  for each row execute function prevent_events_update();

drop trigger if exists routed_requests_prevent_delete on routed_requests;
create trigger routed_requests_prevent_delete
  before delete on routed_requests
  for each row execute function prevent_canonical_history_delete();

drop trigger if exists evidence_items_prevent_delete on evidence_items;
create trigger evidence_items_prevent_delete
  before delete on evidence_items
  for each row execute function prevent_canonical_history_delete();

-- Route facts, ownership, linkage, confirmations, and provenance are immutable.
-- Only a small legal lifecycle may advance; a superseded row is terminal.
create or replace function routed_requests_protect_history()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.intent is distinct from new.intent
    or old.workspace_id is distinct from new.workspace_id
    or old.task_type is distinct from new.task_type
    or old.execution_lane is distinct from new.execution_lane
    or old.selected_agent is distinct from new.selected_agent
    or old.repository is distinct from new.repository
    or old.repository_path is distinct from new.repository_path
    or old.risk is distinct from new.risk
    or old.sensitivity is distinct from new.sensitivity
    or old.required_evidence is distinct from new.required_evidence
    or old.rationale is distinct from new.rationale
    or old.confidence is distinct from new.confidence
    or old.route_source is distinct from new.route_source
    or old.provenance is distinct from new.provenance
    or old.action_id is distinct from new.action_id
    or old.supersedes_request_id is distinct from new.supersedes_request_id
    or old.correction_reason is distinct from new.correction_reason
    or old.idempotency_key is distinct from new.idempotency_key
    or old.confirmation_destructive is distinct from new.confirmation_destructive
    or old.confirmation_protected_operation is distinct from new.confirmation_protected_operation
    or old.confirmation_public_exposure is distinct from new.confirmation_public_exposure
    or old.created_at is distinct from new.created_at
  then
    raise exception 'routed_requests history is immutable; append a correction instead';
  end if;

  if old.status is distinct from new.status and not (
    (old.status in ('proposed', 'confirmed', 'corrected') and new.status in
      ('confirmed', 'superseded', 'rejected', 'blocked_policy'))
    -- A blocked or rejected route can still be corrected: persist_route_atomic
    -- only forbids correcting an already-superseded target, so blocked_policy
    -- and rejected must be able to reach superseded too.
    or (old.status in ('blocked_policy', 'rejected') and new.status = 'superseded')
  ) then
    raise exception 'illegal routed_requests status transition: % -> %', old.status, new.status;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- Evidence facts and links are append-only.  An observation may fill empty
-- source/time/provenance fields once, while status follows an explicit state
-- machine.  Corrections to evidence claims are new rows.
create or replace function evidence_items_protect_history()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.workspace_id is distinct from new.workspace_id
    or old.routed_request_id is distinct from new.routed_request_id
    or old.action_id is distinct from new.action_id
    or old.kind is distinct from new.kind
    or old.claim is distinct from new.claim
    or old.created_at is distinct from new.created_at
    or (old.source is not null and old.source is distinct from new.source)
    or (old.observed_at is not null and old.observed_at is distinct from new.observed_at)
    or (old.provenance <> 'unknown' and old.provenance is distinct from new.provenance)
  then
    raise exception 'evidence_items history is immutable; append corrected evidence instead';
  end if;

  if old.status is distinct from new.status and not (
    (old.status = 'pending' and new.status in ('verified', 'unverified', 'conflict', 'stale'))
    or (old.status = 'verified' and new.status in ('conflict', 'stale'))
    or (old.status = 'unverified' and new.status in ('pending', 'verified', 'conflict', 'stale'))
    or (old.status = 'conflict' and new.status in ('verified', 'unverified', 'stale'))
    or (old.status = 'stale' and new.status in ('pending', 'verified', 'unverified', 'conflict'))
  ) then
    raise exception 'illegal evidence_items status transition: % -> %', old.status, new.status;
  end if;

  -- Closing the transition graph above is not enough on its own: pending,
  -- unverified, and conflict all have a direct edge to verified, so a row
  -- that went stale could still be walked back to verified in one more hop
  -- (stale -> pending -> verified, stale -> unverified -> verified, ...)
  -- while retaining the same frozen, expired observation -- source and
  -- observed_at can never change once set (see the immutability check
  -- above). The real invariant is about the observation, not the status
  -- label: a row can only enter 'verified' the first time it is given a
  -- real observation (old.source is null). Once source is set, re-entering
  -- 'verified' by any path requires a new evidence_items row instead.
  if new.status = 'verified' and old.status <> 'verified' and old.source is not null then
    raise exception 'evidence_items cannot re-enter verified while retaining a previously recorded observation; append a new evidence row with a fresh observation instead';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists evidence_items_touch on evidence_items;
drop trigger if exists evidence_items_protect_history_trigger on evidence_items;
create trigger evidence_items_protect_history_trigger
  before update on evidence_items
  for each row execute function evidence_items_protect_history();

-- One atomic intake boundary.  The service-role caller is trusted only for
-- transport; table constraints and this function enforce workspace/correction
-- integrity.  Action linking remains disabled until actions has an owner-only,
-- workspace-aware policy and relationship.
create or replace function persist_route_atomic(p_proposal jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid := (p_proposal ->> 'workspace_id')::uuid;
  v_idempotency_key uuid := (p_proposal ->> 'idempotency_key')::uuid;
  v_supersedes_id uuid := nullif(p_proposal ->> 'supersedes_request_id', '')::uuid;
  v_action_id uuid := nullif(p_proposal ->> 'action_id', '')::uuid;
  v_existing routed_requests%rowtype;
  v_original routed_requests%rowtype;
  v_route routed_requests%rowtype;
  v_evidence evidence_items%rowtype;
  v_workspace_name text;
begin
  if v_idempotency_key is null then
    raise exception 'idempotency_key is required';
  end if;

  -- Serialize concurrent calls carrying the same idempotency key. Without
  -- this, two racing calls can both miss the row below, race the insert,
  -- and the loser hits the unique index instead of replaying -- defeating
  -- the whole point of the key for concurrent retries/double submissions.
  -- Transaction-scoped: released automatically on commit or rollback, and
  -- calls with a different key never contend.
  perform pg_advisory_xact_lock(hashtextextended(v_idempotency_key::text, 0));

  select * into v_existing
  from routed_requests
  where idempotency_key = v_idempotency_key;

  if found then
    select * into v_evidence
    from evidence_items
    where routed_request_id = v_existing.id
    order by created_at asc
    limit 1;
    return jsonb_build_object(
      'routedRequest', to_jsonb(v_existing),
      'evidence', to_jsonb(v_evidence),
      'workspace', jsonb_build_object('id', v_existing.workspace_id),
      'corrected', v_existing.supersedes_request_id,
      'eventLogged', true,
      'replayed', true
    );
  end if;

  select name into v_workspace_name
  from workspaces
  where id = v_workspace_id;
  if not found then
    raise exception 'unknown_workspace:%', v_workspace_id;
  end if;

  if v_action_id is not null or coalesce((p_proposal ->> 'create_action')::boolean, false) then
    raise exception 'action_link_disabled_pending_owner_policy';
  end if;

  if v_supersedes_id is not null then
    select * into v_original
    from routed_requests
    where id = v_supersedes_id
    for update;
    if not found then
      raise exception 'correction_target_missing:%', v_supersedes_id;
    end if;
    if v_original.workspace_id <> v_workspace_id then
      raise exception 'correction_target_wrong_workspace:%', v_supersedes_id;
    end if;
    if v_original.status = 'superseded' then
      raise exception 'correction_target_superseded:%', v_supersedes_id;
    end if;
  end if;

  insert into routed_requests (
    workspace_id, action_id, supersedes_request_id, correction_reason,
    idempotency_key, intent, task_type, execution_lane, selected_agent,
    repository, repository_path, risk, sensitivity, required_evidence,
    rationale, confidence, status, route_source, provenance,
    confirmation_destructive, confirmation_protected_operation,
    confirmation_public_exposure
  ) values (
    v_workspace_id, null, v_supersedes_id, p_proposal ->> 'correction_reason',
    v_idempotency_key, p_proposal ->> 'intent', p_proposal ->> 'task_type',
    p_proposal ->> 'execution_lane', p_proposal ->> 'selected_agent',
    p_proposal ->> 'repository', nullif(p_proposal ->> 'repository_path', ''),
    p_proposal ->> 'risk', p_proposal ->> 'sensitivity',
    p_proposal ->> 'required_evidence', p_proposal ->> 'rationale',
    (p_proposal ->> 'confidence')::numeric,
    case when v_supersedes_id is null then 'confirmed' else 'corrected' end,
    p_proposal ->> 'route_source', 'user_confirmed',
    coalesce((p_proposal #>> '{confirmations,destructive}')::boolean, false),
    coalesce((p_proposal #>> '{confirmations,protectedOperation}')::boolean, false),
    coalesce((p_proposal #>> '{confirmations,publicExposure}')::boolean, false)
  ) returning * into v_route;

  if v_supersedes_id is not null then
    update routed_requests
    set status = 'superseded'
    where id = v_supersedes_id;
  end if;

  insert into events (workspace_id, action, target_type, target_id, metadata)
  values (
    v_workspace_id,
    case when v_supersedes_id is null then 'route.persisted' else 'route.corrected' end,
    'routed_request',
    v_route.id,
    jsonb_build_object(
      'execution_lane', v_route.execution_lane,
      'repository', v_route.repository,
      'route_source', v_route.route_source,
      'supersedes_request_id', v_supersedes_id,
      'correction_reason', v_route.correction_reason,
      'idempotency_key', v_route.idempotency_key
    )
  );

  insert into evidence_items (
    workspace_id, routed_request_id, action_id, kind, status, claim, provenance
  ) values (
    v_workspace_id, v_route.id, null, p_proposal ->> 'evidence_kind',
    'pending', p_proposal ->> 'required_evidence', 'unknown'
  ) returning * into v_evidence;

  return jsonb_build_object(
    'routedRequest', to_jsonb(v_route),
    'workspace', jsonb_build_object('id', v_workspace_id, 'name', v_workspace_name),
    'actionId', null,
    'eventLogged', true,
    'evidence', to_jsonb(v_evidence),
    'corrected', v_supersedes_id,
    'warnings', jsonb_build_array(),
    'replayed', false
  );
end;
$$;

revoke all on function persist_route_atomic(jsonb) from public, anon, authenticated;
grant execute on function persist_route_atomic(jsonb) to service_role;
