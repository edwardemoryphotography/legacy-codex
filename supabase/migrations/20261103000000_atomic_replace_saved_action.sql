-- Replace an unstarted saved action and record its history in one transaction.
-- Security invoker: the existing mission/action/event RLS policies stay
-- authoritative; there is no admin bypass.
CREATE OR REPLACE FUNCTION public.replace_saved_action_atomic(
  p_action_id uuid,
  p_mission_id uuid,
  p_expected_updated_at timestamptz,
  p_new_title text,
  p_new_note text
)
RETURNS TABLE (
  id uuid,
  mission_id uuid,
  action_title text,
  status text,
  resume_note text,
  updated_at timestamptz,
  replayed boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_action public.actions%ROWTYPE;
  v_key text;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'An authenticated session is required' USING ERRCODE = '28000';
  END IF;
  IF p_action_id IS NULL OR p_mission_id IS NULL OR p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'The action, mission, and expected version are required' USING ERRCODE = '22023';
  END IF;
  IF p_new_title IS NULL OR btrim(p_new_title) = '' OR length(p_new_title) > 2000 THEN
    RAISE EXCEPTION 'The replacement title must be between 1 and 2000 characters' USING ERRCODE = '22023';
  END IF;
  IF p_new_note IS NOT NULL AND length(p_new_note) > 20000 THEN
    RAISE EXCEPTION 'The replacement note is too long' USING ERRCODE = '22023';
  END IF;

  -- Lock the exact action, verify its mission belongs to this account, and
  -- refuse to replace work that has already started.
  SELECT a.* INTO v_action
    FROM public.actions a
    JOIN public.missions m ON m.id = a.mission_id
   WHERE a.id = p_action_id
     AND a.mission_id = p_mission_id
     AND m.user_id = v_owner
   FOR UPDATE OF a;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saved action not found or not owned by this account' USING ERRCODE = 'P0001';
  END IF;
  IF v_action.status <> 'TODO' THEN
    RAISE EXCEPTION 'Only an unstarted saved action can be replaced' USING ERRCODE = 'P0001';
  END IF;

  -- The source version is part of transition identity: A→B→A→B keeps four
  -- distinct transitions, while retrying one transition reuses this key.
  v_key := md5(
    p_action_id::text || '|' ||
    to_char(p_expected_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '|' ||
    p_new_title || '|' || coalesce(p_new_note, '')
  );

  IF EXISTS (
    SELECT 1 FROM public.mission_events e
     WHERE e.user_id = v_owner AND e.idempotency_key = v_key
  ) THEN
    SELECT a.* INTO v_action FROM public.actions a WHERE a.id = p_action_id;
    RETURN QUERY
      SELECT v_action.id, v_action.mission_id, v_action.action_title, v_action.status,
             v_action.resume_note, v_action.updated_at, true;
    RETURN;
  END IF;

  IF v_action.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Saved action changed in another tab; reload before retrying' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.mission_events (user_id, mission_id, type, detail, idempotency_key)
  VALUES (
    v_owner,
    p_mission_id,
    'action_replaced',
    jsonb_build_object(
      'actionId', v_action.id,
      'previousTitle', v_action.action_title,
      'previousStatus', v_action.status,
      'previousResumeNote', v_action.resume_note,
      'previousUpdatedAt', v_action.updated_at,
      'nextTitle', p_new_title,
      'nextResumeNote', p_new_note
    )::text,
    v_key
  );

  UPDATE public.actions a
     SET action_title = p_new_title,
         resume_note = p_new_note,
         is_next_action = true
   WHERE a.id = p_action_id
     AND a.mission_id = p_mission_id
     AND a.status = 'TODO'
     AND a.updated_at = p_expected_updated_at;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saved action changed in another tab; reload before retrying' USING ERRCODE = 'P0001';
  END IF;

  SELECT a.* INTO v_action FROM public.actions a WHERE a.id = p_action_id;
  RETURN QUERY
    SELECT v_action.id, v_action.mission_id, v_action.action_title, v_action.status,
           v_action.resume_note, v_action.updated_at, false;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_saved_action_atomic(uuid, uuid, timestamptz, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_saved_action_atomic(uuid, uuid, timestamptz, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.replace_saved_action_atomic(uuid, uuid, timestamptz, text, text) TO authenticated;
