CREATE OR REPLACE FUNCTION public.create_scan_handoff_session(_context text DEFAULT 'admin_mission'::text)
 RETURNS TABLE(id uuid, token text, short_code text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_token text;
  v_short text;
  v_id uuid;
  v_expires timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.scan_handoff_sessions s
   WHERE s.expires_at < now() - interval '2 hours';

  v_token := replace(encode(extensions.gen_random_bytes(24), 'base64'), '/', '_');
  v_token := replace(v_token, '+', '-');
  v_token := replace(v_token, '=', '');
  v_short := upper(substring(md5(v_token || clock_timestamp()::text), 1, 6));
  v_expires := now() + interval '30 minutes';

  INSERT INTO public.scan_handoff_sessions (token, short_code, created_by, context, expires_at)
  VALUES (v_token, v_short, v_uid, _context, v_expires)
  RETURNING scan_handoff_sessions.id INTO v_id;

  RETURN QUERY SELECT v_id, v_token, v_short, v_expires;
END;
$function$;