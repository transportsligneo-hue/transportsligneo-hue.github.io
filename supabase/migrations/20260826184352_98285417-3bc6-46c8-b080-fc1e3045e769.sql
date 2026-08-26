DO $$
DECLARE
  v_facture_id uuid;
  v_canonical_attr_id uuid;
BEGIN
  SELECT f.id
    INTO v_facture_id
  FROM public.factures f
  JOIN public.attributions old_a ON old_a.id = f.attribution_id
  JOIN public.trajets old_t ON old_t.id = old_a.trajet_id
  WHERE f.numero IN ('FAC-TLG-2026-083', 'FAC-TLG-2026-#083')
    AND old_t.numero_mission = 'MIS-TLG-2026-#053'
  ORDER BY f.created_at DESC
  LIMIT 1;

  SELECT a.id
    INTO v_canonical_attr_id
  FROM public.attributions a
  JOIN public.trajets t ON t.id = a.trajet_id
  WHERE t.numero_mission = 'MIS-TLG-2026-#083'
    AND a.statut IN ('termine', 'validee')
  ORDER BY t.updated_at DESC, a.created_at DESC
  LIMIT 1;

  IF v_facture_id IS NOT NULL AND v_canonical_attr_id IS NOT NULL THEN
    UPDATE public.factures
    SET attribution_id = v_canonical_attr_id,
        mission_id = NULL
    WHERE id = v_facture_id;
  END IF;
END $$;