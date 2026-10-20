-- A priority challenge must switch the occupied mission role atomically.
-- The existing unique index missions_one_primary_per_user rejects a single
-- multi-row UPSERT whose first row becomes Primary before the previous Primary
-- is demoted. Keep both row updates and their audit event in one transaction.
-- Security invoker: existing mission owner RLS policies remain authoritative.
CREATE OR REPLACE FUNCTION public.apply_priority_challenge_atomic(
  p_candidate_id uuid,
  p_displaced_id uuid,
  p_displaced_next_state text,
  p_event_detail text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_previous_state text;
  v_previous_blocker text;
  v_candidate_state text;
  v_candidate_finish_line text;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'An authenticated session is required' USING ERRCODE = '28000';
  END IF;
  IF p_candidate_id IS NULL OR p_displaced_id IS NULL OR p_candidate_id = p_displaced_id THEN
    RAISE EXCEPTION 'A new mission and the displaced mission are both required' USING ERRCODE = '22023';
  END IF;
  IF p_displaced_next_state NOT IN ('parked', 'paused', 'abandoned', 'blocked') THEN
    RAISE EXCEPTION 'Invalid displaced mission state' USING ERRCODE = '22023';
  END IF;
  IF p_event_detail IS NULL OR btrim(p_event_detail) = '' OR length(p_event_detail) > 6000 THEN
    RAISE EXCEPTION 'A recorded reason for the priority change is required' USING ERRCODE = '22023';
  END IF;

  -- Lock and verify both mission records are owned by the authenticated user.
  SELECT state, blocker INTO v_previous_state, v_previous_blocker
    FROM public.missions
   WHERE id = p_displaced_id AND user_id = v_owner
   FOR UPDATE;
  IF NOT FOUND OR v_previous_state NOT IN ('primary', 'secondary') THEN
    RAISE EXCEPTION 'Saved primary or secondary mission has changed; reload before retrying'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT state, finish_line INTO v_candidate_state, v_candidate_finish_line
    FROM public.missions
   WHERE id = p_candidate_id AND user_id = v_owner
   FOR UPDATE;
  IF NOT FOUND
     OR v_candidate_state NOT IN ('candidate', 'parked', 'blocked', 'paused', 'abandoned')
     OR nullif(btrim(v_candidate_finish_line), '') IS NULL THEN
    RAISE EXCEPTION 'Candidate mission is missing or not ready; reload before retrying'
      USING ERRCODE = 'P0001';
  END IF;

  IF (p_displaced_next_state = 'blocked' AND v_previous_blocker IS NULL)
     OR (p_displaced_next_state = 'parked' AND v_previous_blocker IS NOT NULL) THEN
    RAISE EXCEPTION 'Displaced mission blocker changed; reload before retrying'
      USING ERRCODE = 'P0001';
  END IF;

  -- These execute in order *inside one database transaction*. If promoting
  -- the candidate or recording its event fails, demotion is also rolled back.
  UPDATE public.missions
     SET state = p_displaced_next_state, updated_at = now()
   WHERE id = p_displaced_id AND user_id = v_owner;

  UPDATE public.missions
     SET state = v_previous_state, updated_at = now()
   WHERE id = p_candidate_id AND user_id = v_owner;

  INSERT INTO public.mission_events
    (user_id, mission_id, type, detail, idempotency_key)
  VALUES
    (v_owner, p_candidate_id, 'priority_challenge_applied',
     p_event_detail, gen_random_uuid()::text);

  RETURN true;
END;
$$;

-- Explicit least-privilege: authenticated sessions only, with invoker RLS.
REVOKE ALL ON FUNCTION public.apply_priority_challenge_atomic(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_priority_challenge_atomic(uuid, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_priority_challenge_atomic(uuid, uuid, text, text) TO authenticated;
