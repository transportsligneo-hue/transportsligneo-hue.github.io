CREATE OR REPLACE FUNCTION public.driver_apply_to_mission(_trajet_id uuid, _proposed_price numeric DEFAULT NULL::numeric, _message text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_conv_id uuid;
  v_conv_niveau text;
  v_selected RECORD;
  v_group_base numeric := 0;
  v_final_total numeric := 0;
  v_type text;
  v_offre_id uuid;
  v_count integer := 0;
  v_idx integer := 0;
  v_remaining numeric := 0;
  v_leg_base numeric := 0;
  v_leg_price numeric := 0;
  v_any_existing boolean := false;
  v_group_is_ar boolean := false;
  r RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id, niveau INTO v_conv_id, v_conv_niveau
  FROM public.convoyeurs
  WHERE user_id = v_uid
    AND statut = 'valide'
    AND has_completed_training = true;

  IF v_conv_id IS NULL THEN
    RAISE EXCEPTION 'Formation obligatoire non terminée ou convoyeur non validé';
  END IF;

  SELECT * INTO v_selected
  FROM public.trajets
  WHERE id = _trajet_id;

  IF v_selected.id IS NULL THEN
    RAISE EXCEPTION 'Trajet introuvable';
  END IF;

  IF public.convoyeur_level_rank(v_conv_niveau) < public.convoyeur_level_rank(v_selected.niveau_requis) THEN
    RAISE EXCEPTION 'Mission réservée aux convoyeurs de niveau supérieur';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.trajets tg
    WHERE tg.mission_group_id = v_selected.mission_group_id
      AND tg.leg_type IN ('aller', 'retour')
    GROUP BY tg.mission_group_id
    HAVING count(DISTINCT tg.leg_type) >= 2
  ) INTO v_group_is_ar;

  CREATE TEMP TABLE tmp_catalog_apply_legs ON COMMIT DROP AS
  SELECT t.*
  FROM public.trajets t
  WHERE (
    v_group_is_ar
    AND t.mission_group_id = v_selected.mission_group_id
    AND t.leg_type IN ('aller', 'retour')
  ) OR (
    NOT v_group_is_ar
    AND t.id = v_selected.id
  )
  ORDER BY CASE t.leg_type WHEN 'aller' THEN 1 WHEN 'retour' THEN 2 ELSE 3 END, t.created_at, t.id;

  IF EXISTS (
    SELECT 1
    FROM tmp_catalog_apply_legs
    WHERE statut_publication <> 'publie'
       OR attribution_mode NOT IN ('catalogue','mixte')
  ) THEN
    RAISE EXCEPTION 'Mission indisponible au catalogue';
  END IF;

  IF EXISTS (
    SELECT 1 FROM tmp_catalog_apply_legs
    WHERE public.convoyeur_level_rank(niveau_requis) > public.convoyeur_level_rank(v_conv_niveau)
  ) THEN
    RAISE EXCEPTION 'Mission réservée aux convoyeurs de niveau supérieur';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.mission_offres mo
    JOIN tmp_catalog_apply_legs l ON l.id = mo.trajet_id
    WHERE mo.convoyeur_id = v_conv_id
      AND mo.statut IN ('en_attente', 'contre_offre_admin', 'accepte', 'acceptee')
  ) INTO v_any_existing;

  IF v_any_existing THEN
    RAISE EXCEPTION 'Vous avez déjà candidaté à cette mission';
  END IF;

  SELECT
    count(*),
    COALESCE(sum(COALESCE(prix_convoyeur_fixe, prix_convoyeur, prix_suggere, 0)), 0)
  INTO v_count, v_group_base
  FROM tmp_catalog_apply_legs;

  v_final_total := COALESCE(_proposed_price, v_group_base, 0);

  IF _proposed_price IS NOT NULL AND _proposed_price <> v_group_base THEN
    IF EXISTS (SELECT 1 FROM tmp_catalog_apply_legs WHERE NOT allow_counter_offer) THEN
      RAISE EXCEPTION 'Les contre-offres ne sont pas autorisées sur cette mission';
    END IF;
    v_type := 'contre_proposition';
  ELSE
    v_type := 'acceptation';
  END IF;

  v_remaining := v_final_total;

  FOR r IN SELECT * FROM tmp_catalog_apply_legs LOOP
    v_idx := v_idx + 1;
    v_leg_base := COALESCE(r.prix_convoyeur_fixe, r.prix_convoyeur, r.prix_suggere, 0);

    IF v_idx = v_count THEN
      v_leg_price := v_remaining;
    ELSIF v_group_base > 0 THEN
      v_leg_price := round((v_final_total * v_leg_base / v_group_base)::numeric, 2);
    ELSE
      v_leg_price := round((v_final_total / GREATEST(v_count, 1))::numeric, 2);
    END IF;

    v_remaining := v_remaining - v_leg_price;

    INSERT INTO public.mission_offres (
      trajet_id, convoyeur_id, prix_propose, prix_suggere_snapshot, type_offre, statut, message
    ) VALUES (
      r.id, v_conv_id, v_leg_price, v_leg_base, v_type, 'en_attente',
      NULLIF(trim(COALESCE(_message, '')), '')
    )
    RETURNING id INTO v_offre_id;
  END LOOP;

  SELECT mo.id INTO v_offre_id
  FROM public.mission_offres mo
  WHERE mo.convoyeur_id = v_conv_id
    AND mo.trajet_id = _trajet_id
  ORDER BY mo.created_at DESC
  LIMIT 1;

  PERFORM public.create_admin_notification(
    'mission_offre',
    CASE WHEN v_type = 'contre_proposition' THEN 'Contre-offre reçue' ELSE 'Nouvelle candidature reçue' END,
    CASE WHEN v_group_is_ar THEN 'Livraison + Restitution — ' ELSE '' END ||
      COALESCE(v_selected.depart, '') || ' → ' || COALESCE(v_selected.arrivee, '') || ' — ' || v_final_total::text || ' €',
    '/admin/candidatures',
    'mission_offre',
    v_offre_id,
    jsonb_build_object(
      'trajet_id', _trajet_id,
      'mission_group_id', v_selected.mission_group_id,
      'convoyeur_id', v_conv_id,
      'prix', v_final_total,
      'grouped_ar', v_group_is_ar
    )
  );

  RETURN v_offre_id;
END;
$function$;

DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT id FROM public.convoyeurs LOOP
    PERFORM public.recompute_convoyeur_niveau(c.id);
  END LOOP;
END $$;