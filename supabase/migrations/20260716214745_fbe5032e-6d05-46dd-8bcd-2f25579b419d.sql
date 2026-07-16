
CREATE OR REPLACE FUNCTION public.admin_convert_demande_to_missions(_demande_id uuid)
RETURNS TABLE(mission_id uuid, leg text, numero text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  d record;
  v_is_ar boolean;
  v_group uuid;
  v_aller numeric;
  v_retour numeric;
  v_split record;
  v_mid uuid;
  v_num text;
  v_user_id uuid;
  v_client_nom text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO d FROM public.demandes_convoyage WHERE id = _demande_id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Demande introuvable'; END IF;

  v_is_ar := (
    d.options = 'aller_retour'
    OR (d.depart_retour IS NOT NULL AND length(trim(d.depart_retour)) > 0)
    OR (d.arrivee_retour IS NOT NULL AND length(trim(d.arrivee_retour)) > 0)
    OR d.date_retour IS NOT NULL
  );

  v_user_id := d.user_id;
  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id FROM public.profiles WHERE lower(email) = lower(COALESCE(d.email,'')) LIMIT 1;
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Aucun compte client associé (email %). Créez ou liez un compte avant conversion.', d.email;
  END IF;

  IF v_is_ar THEN
    SELECT * INTO v_split FROM public.split_ar_prices(COALESCE(d.prix_estime, 0));
    v_aller := v_split.aller; v_retour := v_split.retour;
  ELSE
    v_aller := COALESCE(d.prix_estime, 0); v_retour := 0;
  END IF;

  v_group := CASE WHEN v_is_ar THEN gen_random_uuid() ELSE NULL END;
  v_client_nom := trim(coalesce(d.prenom,'') || ' ' || coalesce(d.nom,''));

  -- Aller (ou mission simple) : mission + trajet parallèle
  INSERT INTO public.missions (
    user_id, nom, prenom, email, telephone,
    ville_depart, ville_arrivee, date_prise_en_charge,
    type_trajet, marque, modele, immatriculation, carburant, remarques,
    prix_total, statut, mission_group_id, leg_type, leg_index
  ) VALUES (
    v_user_id, d.nom, d.prenom, d.email, d.telephone,
    d.depart, d.arrivee, COALESCE(d.date_souhaitee, current_date),
    CASE WHEN v_is_ar THEN 'aller_retour' ELSE 'aller_simple' END,
    COALESCE(NULLIF(d.vehicule_marque,''), d.marque),
    COALESCE(NULLIF(d.vehicule_modele,''), d.modele),
    COALESCE(NULLIF(d.vehicule_immatriculation,''), d.immatriculation),
    COALESCE(NULLIF(d.vehicule_energie,''), d.carburant),
    d.message,
    v_aller, 'en_attente', v_group,
    CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END, 1
  ) RETURNING id, numero INTO v_mid, v_num;

  INSERT INTO public.trajets (
    demande_id, depart, arrivee, date_trajet, heure_trajet,
    marque, modele, immatriculation,
    client_nom, client_email, client_telephone,
    prix, prix_client, commission_convoyeur_pct,
    statut, statut_publication, pricing_mode,
    vehicule_immatriculation, vehicule_vin, vehicule_energie,
    vehicule_type, vehicule_couleur, vehicule_km, vehicule_notes,
    options_meta, mission_group_id, leg_type, leg_index
  ) VALUES (
    d.id, d.depart, d.arrivee, d.date_souhaitee, COALESCE(d.heure_souhaitee,''),
    COALESCE(NULLIF(d.vehicule_marque,''), d.marque, ''),
    COALESCE(NULLIF(d.vehicule_modele,''), d.modele, ''),
    COALESCE(NULLIF(d.vehicule_immatriculation,''), d.immatriculation, ''),
    v_client_nom, d.email, coalesce(d.telephone,''),
    v_aller, v_aller, 65,
    'en_attente', 'publie', 'fixe',
    COALESCE(NULLIF(d.vehicule_immatriculation,''), d.immatriculation),
    d.vehicule_vin,
    COALESCE(NULLIF(d.vehicule_energie,''), d.carburant),
    d.vehicule_type, d.vehicule_couleur, d.vehicule_km, d.vehicule_notes,
    coalesce(d.options_meta, '{}'::jsonb),
    v_group,
    CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END, 1
  );

  mission_id := v_mid; leg := CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END; numero := v_num;
  RETURN NEXT;

  IF v_is_ar THEN
    INSERT INTO public.missions (
      user_id, nom, prenom, email, telephone,
      ville_depart, ville_arrivee, date_prise_en_charge,
      type_trajet, marque, modele, immatriculation, carburant, remarques,
      prix_total, statut, mission_group_id, leg_type, leg_index
    ) VALUES (
      v_user_id, d.nom, d.prenom, d.email, d.telephone,
      COALESCE(
        NULLIF(trim(COALESCE(d.adresse_recuperation_retour,'')),''),
        NULLIF(trim(COALESCE(d.depart_retour,'')),''),
        d.arrivee
      ),
      COALESCE(NULLIF(trim(COALESCE(d.arrivee_retour,'')),''), d.depart),
      COALESCE(d.date_retour, d.date_souhaitee, current_date),
      'aller_retour',
      COALESCE(NULLIF(d.marque_retour,''), NULLIF(d.vehicule_marque,''), d.marque),
      COALESCE(NULLIF(d.modele_retour,''), NULLIF(d.vehicule_modele,''), d.modele),
      COALESCE(NULLIF(d.immatriculation_retour,''), NULLIF(d.vehicule_immatriculation,''), d.immatriculation),
      COALESCE(NULLIF(d.vehicule_energie,''), d.carburant),
      d.message,
      v_retour, 'en_attente', v_group, 'retour', 2
    ) RETURNING id, numero INTO v_mid, v_num;

    INSERT INTO public.trajets (
      demande_id, depart, arrivee, date_trajet, heure_trajet,
      marque, modele, immatriculation,
      client_nom, client_email, client_telephone,
      prix, prix_client, commission_convoyeur_pct,
      statut, statut_publication, pricing_mode,
      vehicule_immatriculation, vehicule_vin, vehicule_energie,
      options_meta, mission_group_id, leg_type, leg_index
    ) VALUES (
      d.id,
      COALESCE(
        NULLIF(trim(COALESCE(d.adresse_recuperation_retour,'')),''),
        NULLIF(trim(COALESCE(d.depart_retour,'')),''),
        d.arrivee
      ),
      COALESCE(NULLIF(trim(COALESCE(d.arrivee_retour,'')),''), d.depart),
      COALESCE(d.date_retour, d.date_souhaitee),
      COALESCE(d.heure_retour, ''),
      COALESCE(NULLIF(d.marque_retour,''), NULLIF(d.vehicule_marque,''), d.marque, ''),
      COALESCE(NULLIF(d.modele_retour,''), NULLIF(d.vehicule_modele,''), d.modele, ''),
      COALESCE(NULLIF(d.immatriculation_retour,''), NULLIF(d.vehicule_immatriculation,''), d.immatriculation, ''),
      v_client_nom, d.email, coalesce(d.telephone,''),
      v_retour, v_retour, 65,
      'en_attente', 'publie', 'fixe',
      COALESCE(NULLIF(d.immatriculation_retour,''), NULLIF(d.vehicule_immatriculation,''), d.immatriculation),
      COALESCE(d.vin_retour, d.vehicule_vin),
      COALESCE(NULLIF(d.vehicule_energie,''), d.carburant),
      coalesce(d.options_meta, '{}'::jsonb),
      v_group, 'retour', 2
    );

    mission_id := v_mid; leg := 'retour'; numero := v_num;
    RETURN NEXT;
  END IF;

  UPDATE public.demandes_convoyage
     SET statut = 'convertie',
         mission_group_id = COALESCE(v_group, mission_group_id),
         updated_at = now()
   WHERE id = _demande_id;

  RETURN;
END;
$$;
