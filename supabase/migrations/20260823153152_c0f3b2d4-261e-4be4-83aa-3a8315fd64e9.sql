CREATE OR REPLACE FUNCTION public.archive_missions_60d()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.trajets
     SET archived_at = now()
   WHERE archived_at IS NULL
     AND statut IN ('termine', 'annule')
     AND GREATEST(
           COALESCE(date_trajet::timestamptz, created_at),
           COALESCE(updated_at, created_at)
         ) < now() - INTERVAL '60 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_missions_60d() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_missions_60d() TO service_role;

CREATE INDEX IF NOT EXISTS idx_trajets_archived_at ON public.trajets (archived_at);

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('archive-missions-60d')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'archive-missions-60d');

SELECT cron.schedule(
  'archive-missions-60d',
  '15 2 * * *',
  $$ SELECT public.archive_missions_60d(); $$
);