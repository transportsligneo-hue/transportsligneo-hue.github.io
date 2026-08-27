CREATE OR REPLACE FUNCTION public.admin_update_trajet_prix(_trajet_id uuid, _prix numeric, _prix_convoyeur numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_actor text;
  v_old numeric;
  v_group uuid;
  v_lot uuid;
  v_leg text;
  v_devis uuid;
  v_mission uuid;
  v_attr uuid;
  v_plate text;
  v_devis_updated boolean := false;
  v_facture_updated boolean := false;
  v_facture_blocked boolean := false;
  v_sum numeric;
  v_aller numeric;
  v_retour numeric;
  v_group_total numeric;
  v_vehicules jsonb;
  v_attr_ids uuid[];
  v_mission_ids uuid[];
  r record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _prix IS NULL OR _prix < 0 OR _prix > 100000 THEN RAISE EXCEPTION 'Prix invalide'; END IF;

  SELECT prix, mission_group_id, lot_id, leg_type, devis_id, mission_id,
         upper(btrim(COALESCE(immatriculation, vehicule_immatriculation, '')))
    INTO v_old, v_group, v_lot, v_leg, v_devis, v_mission, v_plate
  FROM public.trajets WHERE id = _trajet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trajet introuvable'; END IF;

  SELECT COALESCE(NULLIF(TRIM(COALESCE(prenom,'') || ' ' || COALESCE(nom,'')),''), email, 'Admin')
    INTO v_actor FROM public.profiles WHERE id = v_uid;

  UPDATE public.trajets
     SET prix = round(_prix,2),
         prix_client = round(_prix,2),
         prix_convoyeur = COALESCE(round(_prix_convoyeur,2), prix_convoyeur),
         tarif_convoyeur = COALESCE(round(_prix_convoyeur,2), tarif_convoyeur),
         updated_at = now()
   WHERE id = _trajet_id;

  -- Mission côté client
  IF v_mission IS NULL AND v_group IS NOT NULL THEN
    SELECT id INTO v_mission FROM public.missions
     WHERE mission_group_id = v_group AND COALESCE(leg_type,'simple') = COALESCE(v_leg,'simple')
     LIMIT 1;
  END IF;
  IF v_mission IS NOT NULL THEN
    UPDATE public.missions
       SET prix_total = round(_prix,2), prix_locked = true, updated_at = now()
     WHERE id = v_mission;
  END IF;

  -- Total réel de la mission (tous les volets du duo / du lot)
  IF v_group IS NOT NULL THEN
    SELECT COALESCE(SUM(COALESCE(prix_client, prix)),0) INTO v_group_total
      FROM public.trajets WHERE mission_group_id = v_group;
  ELSE
    v_group_total := round(_prix,2);
  END IF;

  -- Devis : toujours resynchronisé sur les trajets réels
  IF v_devis IS NOT NULL THEN
    IF v_group IS NOT NULL OR v_lot IS NOT NULL THEN
      SELECT COALESCE(SUM(prix),0),
             COALESCE(SUM(prix) FILTER (WHERE COALESCE(leg_type,'aller') <> 'retour'),0),
             COALESCE(SUM(prix) FILTER (WHERE leg_type = 'retour'),0)
        INTO v_sum, v_aller, v_retour
      FROM public.trajets WHERE devis_id = v_devis;
    ELSE
      v_sum := round(_prix,2); v_aller := round(_prix,2); v_retour := 0;
    END IF;

    SELECT vehicules INTO v_vehicules FROM public.devis WHERE id = v_devis;
    IF jsonb_typeof(v_vehicules) = 'array' AND v_plate IS NOT NULL AND v_plate <> '' THEN
      SELECT jsonb_agg(
               CASE WHEN upper(replace(btrim(COALESCE(elem->>'immatriculation','')),'-',''))
                         = upper(replace(v_plate,'-',''))
                    THEN elem || jsonb_build_object('prix', round(_prix,2))
                    ELSE elem END
               ORDER BY ord
             )
        INTO v_vehicules
      FROM jsonb_array_elements(v_vehicules) WITH ORDINALITY AS a(elem, ord);
    END IF;

    UPDATE public.devis
       SET prix_estime = round(v_sum,2),
           prix_aller = round(v_aller,2),
           prix_retour = round(v_retour,2),
           vehicules = COALESCE(v_vehicules, vehicules),
           updated_at = now()
     WHERE id = v_devis;
    IF FOUND THEN v_devis_updated := true; END IF;
  END IF;

  -- Factures rattachées à n'importe quel volet de la mission
  IF v_group IS NOT NULL THEN
    SELECT COALESCE(array_agg(a.id), '{}'::uuid[]) INTO v_attr_ids
      FROM public.attributions a
      JOIN public.trajets t ON t.id = a.trajet_id
     WHERE t.mission_group_id = v_group;
    SELECT COALESCE(array_agg(t.mission_id), '{}'::uuid[]) INTO v_mission_ids
      FROM public.trajets t
     WHERE t.mission_group_id = v_group AND t.mission_id IS NOT NULL;
  ELSE
    SELECT COALESCE(array_agg(a.id), '{}'::uuid[]) INTO v_attr_ids
      FROM public.attributions a WHERE a.trajet_id = _trajet_id;
    v_mission_ids := CASE WHEN v_mission IS NULL THEN '{}'::uuid[] ELSE ARRAY[v_mission] END;
  END IF;

  FOR r IN
    SELECT f.id, f.statut, COALESCE(NULLIF(f.tva_taux,0),20) AS taux
      FROM public.factures f
     WHERE f.attribution_id = ANY(v_attr_ids)
        OR f.mission_id = ANY(v_mission_ids)
  LOOP
    IF COALESCE(r.statut,'') NOT IN ('payee','annulee') THEN
      UPDATE public.factures
         SET prix_ttc = round(v_group_total,2),
             prix_ht = CASE WHEN COALESCE(tva_taux,0) = 0 THEN round(v_group_total,2)
                            ELSE round(v_group_total / (1 + r.taux/100.0), 2) END,
             prix_tva = CASE WHEN COALESCE(tva_taux,0) = 0 THEN 0
                             ELSE round(v_group_total - (v_group_total / (1 + r.taux/100.0)), 2) END,
             updated_at = now()
       WHERE id = r.id;
      v_facture_updated := true;
    ELSE
      v_facture_blocked := true;
    END IF;
  END LOOP;

  INSERT INTO public.activity_logs (actor_user_id, actor_label, action, entity_type, entity_id, metadata, old_value, new_value)
  VALUES (
    v_uid, COALESCE(v_actor,'Admin'), 'mission_prix_modifie', 'trajet', _trajet_id,
    jsonb_build_object(
      'leg', COALESCE(v_leg,'simple'),
      'leg_label', CASE WHEN v_leg = 'retour' THEN 'Restitution' WHEN v_leg = 'aller' THEN 'Livraison' ELSE 'Mission simple' END,
      'attribution_id', (SELECT a.id FROM public.attributions a WHERE a.trajet_id = _trajet_id ORDER BY a.created_at DESC LIMIT 1),
      'mission_group_id', v_group,
      'lot_id', v_lot,
      'immatriculation', v_plate,
      'group_total', round(v_group_total,2),
      'devis_updated', v_devis_updated,
      'facture_updated', v_facture_updated,
      'facture_blocked', v_facture_blocked
    ),
    jsonb_build_object('prix', v_old),
    jsonb_build_object('prix', round(_prix,2))
  );

  RETURN jsonb_build_object(
    'old_prix', v_old,
    'new_prix', round(_prix,2),
    'group_total', round(v_group_total,2),
    'devis_updated', v_devis_updated,
    'facture_updated', v_facture_updated,
    'facture_blocked', v_facture_blocked
  );
END;
$function$;