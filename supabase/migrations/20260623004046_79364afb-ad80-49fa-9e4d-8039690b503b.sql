ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.trajets ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_missions_archived_at ON public.missions (archived_at);
CREATE INDEX IF NOT EXISTS idx_trajets_archived_at ON public.trajets (archived_at);

CREATE OR REPLACE FUNCTION public.auto_archive_old_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.missions
     SET archived_at = now()
   WHERE archived_at IS NULL
     AND statut IN ('livree','annulee')
     AND updated_at < now() - INTERVAL '30 days';

  UPDATE public.trajets
     SET archived_at = now()
   WHERE archived_at IS NULL
     AND statut_publication IN ('termine','annule','archive')
     AND updated_at < now() - INTERVAL '30 days';

  UPDATE public.devis
     SET archived_at = now()
   WHERE archived_at IS NULL
     AND (
       (statut = 'expire' AND updated_at < now() - INTERVAL '30 days')
       OR (paid_at IS NOT NULL AND paid_at < now() - INTERVAL '30 days')
     );
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-archive-30d') THEN
      PERFORM cron.unschedule('auto-archive-30d');
    END IF;
    PERFORM cron.schedule(
      'auto-archive-30d',
      '15 3 * * *',
      $cron$ SELECT public.auto_archive_old_records(); $cron$
    );
  END IF;
END$$;