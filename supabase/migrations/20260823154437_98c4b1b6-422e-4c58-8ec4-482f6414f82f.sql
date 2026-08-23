CREATE OR REPLACE FUNCTION public.archive_missions_60d()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  n integer;
BEGIN
  UPDATE public.trajets
     SET archived_at = now()
   WHERE archived_at IS NULL
     AND statut IN ('termine', 'annule')
     AND COALESCE(date_trajet::timestamptz, created_at) < now() - INTERVAL '60 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$function$;

SELECT public.archive_missions_60d();