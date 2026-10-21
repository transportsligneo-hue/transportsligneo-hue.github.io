-- Supprime les fausses alertes « Retard » en boucle et réinitialise le suivi ETA.
DELETE FROM public.admin_notifications
 WHERE type = 'driver_action' AND titre LIKE 'Retard %';
UPDATE public.mission_eta_tracking
   SET last_alert_bucket = 0, last_alert_at = NULL;

-- Verrou anti-doublon des rappels clients J-1 (enlèvement / livraison).
CREATE TABLE IF NOT EXISTS public.client_rappels_j1 (
  attribution_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('enlevement','livraison')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attribution_id, kind)
);
ALTER TABLE public.client_rappels_j1 ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.client_rappels_j1 TO service_role;
