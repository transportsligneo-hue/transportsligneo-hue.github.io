ALTER TABLE public.attributions DISABLE TRIGGER trg_attributions_protect_admin_fields;

UPDATE public.attributions a
SET numero_mission = regexp_replace(a.numero_mission, '[AR]$', '')
FROM public.trajets t
WHERE t.id = a.trajet_id
  AND a.numero_mission ~ '[AR]$'
  AND COALESCE(t.is_round_trip, false) = false
  AND COALESCE(t.leg_type, 'simple') NOT IN ('aller','retour')
  AND NOT EXISTS (
    SELECT 1 FROM public.attributions b
    WHERE b.numero_mission = regexp_replace(a.numero_mission, '[AR]$', '')
      AND b.id <> a.id
  );

ALTER TABLE public.attributions ENABLE TRIGGER trg_attributions_protect_admin_fields;