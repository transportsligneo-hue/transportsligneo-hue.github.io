
-- 1) Retirer la policy publique qui exposait tous les jetons actifs
DROP POLICY IF EXISTS "Public resolves live scan handoff sessions" ON public.scan_handoff_sessions;

-- 2) Remonter resolve_scan_handoff_token en SECURITY DEFINER pour qu'elle continue
--    de fonctionner sans policy publique. Elle ne renvoie que des champs non sensibles
--    et exige le jeton exact en entrée.
CREATE OR REPLACE FUNCTION public.resolve_scan_handoff_token(_token text)
RETURNS TABLE(session_id uuid, context text, expires_at timestamp with time zone, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT s.id, s.context, s.expires_at, s.status
    FROM public.scan_handoff_sessions s
   WHERE s.token = _token
     AND s.expires_at > now()
   LIMIT 1;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.resolve_scan_handoff_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_scan_handoff_token(text) TO anon, authenticated;
