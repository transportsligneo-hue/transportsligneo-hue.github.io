-- Alertes opérationnelles : validation « tout est en ordre » avec une note (ex. convoyeur joint au téléphone).
ALTER TABLE public.mission_alerts ADD COLUMN IF NOT EXISTS resolution_note text;

CREATE OR REPLACE FUNCTION public.resolve_mission_alert_note(_alert_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.mission_alerts
     SET status = 'resolved',
         resolved_at = now(),
         resolution_note = nullif(btrim(_note), ''),
         acknowledged_by = COALESCE(acknowledged_by, auth.uid()),
         acknowledged_at = COALESCE(acknowledged_at, now())
   WHERE id = _alert_id;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_mission_alert_note(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_mission_alert_note(uuid, text) TO authenticated;

-- Nettoyage : les alertes déjà créées sur des missions de démonstration / test sont supprimées.
DELETE FROM public.mission_alerts ma
 USING public.attributions a, public.trajets t
 WHERE ma.attribution_id = a.id AND t.id = a.trajet_id
   AND (t.is_test_data = true OR lower(coalesce(t.client_email,'')) = 'demo-flotte@transportsligneo.fr' OR lower(coalesce(t.client_nom,'')) ~ '^(démo|demo|test)');
