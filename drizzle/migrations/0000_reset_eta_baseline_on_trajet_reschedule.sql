-- Quand la date/heure d'une mission change, l'ETA de référence doit être remis à zéro
-- pour éviter les fausses alertes de retard.
CREATE OR REPLACE FUNCTION public.reset_eta_tracking_on_reschedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.date_trajet IS DISTINCT FROM OLD.date_trajet)
     OR (NEW.heure_trajet IS DISTINCT FROM OLD.heure_trajet) THEN
    DELETE FROM public.mission_eta_tracking
    WHERE attribution_id IN (
      SELECT a.id FROM public.attributions a WHERE a.trajet_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_eta_tracking_on_reschedule ON public.trajets;
CREATE TRIGGER trg_reset_eta_tracking_on_reschedule
AFTER UPDATE OF date_trajet, heure_trajet ON public.trajets
FOR EACH ROW
EXECUTE FUNCTION public.reset_eta_tracking_on_reschedule();