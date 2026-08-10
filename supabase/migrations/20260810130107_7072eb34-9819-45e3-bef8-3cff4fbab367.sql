CREATE OR REPLACE FUNCTION public.admin_cancel_mission(_attribution_id uuid, _categorie text, _motif text DEFAULT NULL::text, _facturable boolean DEFAULT false, _indemnite numeric DEFAULT NULL::numeric, _passage_vide boolean DEFAULT false, _cancel_trajet boolean DEFAULT true, _apply_group boolean DEFAULT true)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_trajet uuid;
  v_group uuid;
  v_targets uuid[];
  v_attr uuid;
  v_count integer := 0;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF _categorie IS NULL OR btrim(_categorie) = '' THEN
    RAISE EXCEPTION 'Motif d''annulation requis';
  END IF;

  SELECT a.trajet_id, t.mission_group_id
    INTO v_trajet, v_group
    FROM public.attributions a
    JOIN public.trajets t ON t.id = a.trajet_id
   WHERE a.id = _attribution_id;

  IF v_trajet IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable';
  END IF;

  IF coalesce(_apply_group, true) AND v_group IS NOT NULL THEN
    SELECT array_agg(a.id)
      INTO v_targets
      FROM public.attributions a
      JOIN public.trajets t ON t.id = a.trajet_id
     WHERE t.mission_group_id = v_group;
  END IF;

  IF v_targets IS NULL OR array_length(v_targets, 1) IS NULL THEN
    v_targets := ARRAY[_attribution_id];
  END IF;

  FOREACH v_attr IN ARRAY v_targets LOOP
    UPDATE public.attributions
       SET statut = 'annule',
           annulation_categorie = _categorie,
           annulation_motif = NULLIF(btrim(coalesce(_motif, '')), ''),
           annulation_at = now(),
           annulation_par = auth.uid(),
           annulation_facturable = coalesce(_facturable, false),
           annulation_indemnite = CASE WHEN v_attr = _attribution_id THEN _indemnite ELSE NULL END,
           annulation_passage_vide = coalesce(_passage_vide, false),
           updated_at = now()
     WHERE id = v_attr
     RETURNING trajet_id INTO v_trajet;

    IF coalesce(_cancel_trajet, true) AND v_trajet IS NOT NULL THEN
      UPDATE public.trajets
         SET statut = 'annule',
             statut_publication = 'annule'
       WHERE id = v_trajet;
    END IF;

    INSERT INTO public.mission_etape_history (attribution_id, etape, notes, created_by)
    VALUES (
      v_attr,
      'mission_annulee',
      'Annulation admin · ' || _categorie
        || coalesce(' · ' || NULLIF(btrim(coalesce(_motif, '')), ''), '')
        || CASE WHEN coalesce(_facturable, false) THEN ' · facturable' ELSE ' · non facturable' END
        || coalesce(' · indemnité ' || _indemnite::text || ' EUR', '')
        || CASE WHEN v_attr <> _attribution_id THEN ' · propagé depuis le volet jumeau' ELSE '' END,
      auth.uid()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_mission_po(_attribution_id uuid, _po text, _apply_group boolean DEFAULT true)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_trajet uuid;
  v_group uuid;
  v_po text := NULLIF(btrim(coalesce(_po, '')), '');
  v_count integer := 0;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT a.trajet_id, t.mission_group_id
    INTO v_trajet, v_group
    FROM public.attributions a
    JOIN public.trajets t ON t.id = a.trajet_id
   WHERE a.id = _attribution_id;

  IF v_trajet IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable';
  END IF;

  IF coalesce(_apply_group, true) AND v_group IS NOT NULL THEN
    UPDATE public.trajets SET commande_ref = v_po WHERE mission_group_id = v_group;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    UPDATE public.trajets SET commande_ref = v_po WHERE id = v_trajet;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  RETURN v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_set_mission_po(uuid, text, boolean) TO authenticated;