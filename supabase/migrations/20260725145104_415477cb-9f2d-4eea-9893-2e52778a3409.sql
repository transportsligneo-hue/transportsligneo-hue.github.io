CREATE OR REPLACE FUNCTION public.admin_convert_demande_to_missions(_demande_id uuid)
RETURNS TABLE(mission_id uuid, leg text, numero text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  d record;
  v_is_ar boolean;
  v_group uuid;
  v_aller numeric;
  v_retour numeric;
  v_split record;
  v_mid uuid;
  v_tid uuid;
  v_num text;
  v_user_id uuid;
  v_client_nom text;
  v_vehicle_marque text;
  v_vehicle_modele text;
  v_vehicle_immat text;
  v_vehicle_energy text;
  v_contact_depart_nom text;
  v_contact_depart_tel text;
  v_contact_depart_note text;
  v_contact_arrivee_nom text;
  v_contact_arrivee_tel text;
  v_contact_arrivee_note text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (public.has_role(v_uid, 'admin'::public.app_role) OR public.has_role(v_uid, 'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO d
  FROM public.demandes_convoyage
  WHERE id = _demande_id
  FOR UPDATE;

  IF d.id IS NULL THEN
    RAISE EXCEPTION 'Demande introuvable';
  END IF;

  IF d.statut = 'convertie' THEN
    RETURN QUERY
      SELECT m.id,
             COALESCE(m.leg_type, 'simple')::text,
             m.numero::text
      FROM public.missions m
      WHERE m.mission_group_id = d.mission_group_id
         OR (
           d.mission_group_id IS NULL
           AND lower(m.email) = lower(d.email)
           AND m.ville_depart = d.depart
           AND m.ville_arrivee = d.arrivee
           AND m.created_at >= d.updated_at - interval '10 minutes'
         )
      ORDER BY COALESCE(m.leg_index, 1), m.created_at;
    RETURN;
  END IF;

  v_is_ar := (
    d.options = 'aller_retour'
    OR (d.depart_retour IS NOT NULL AND length(trim(d.depart_retour)) > 0)
    OR (d.arrivee_retour IS NOT NULL AND length(trim(d.arrivee_retour)) > 0)
    OR d.date_retour IS NOT NULL
  );

  v_user_id := d.user_id;
  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id
    FROM public.profiles
    WHERE lower(email) = lower(COALESCE(d.email, ''))
      AND user_id IS NOT NULL
    LIMIT 1;
  END IF;

  -- Certaines demandes viennent du formulaire public et ne sont pas encore rattachées
  -- à un compte client. On conserve les coordonnées client sur la mission/le trajet,
  -- mais on rattache techniquement la ligne à l'admin qui effectue la conversion afin
  -- de ne pas bloquer le dispatch opérationnel.
  v_user_id := COALESCE(v_user_id, v_uid);

  IF v_is_ar THEN
    SELECT * INTO v_split FROM public.split_ar_prices(COALESCE(d.prix_estime, 0));
    v_aller := v_split.aller;
    v_retour := v_split.retour;
  ELSE
    v_aller := COALESCE(d.prix_estime, 0);
    v_retour := 0;
  END IF;

  v_group := gen_random_uuid();
  v_client_nom := trim(COALESCE(d.prenom, '') || ' ' || COALESCE(d.nom, ''));
  v_vehicle_marque := COALESCE(NULLIF(d.vehicule_marque, ''), NULLIF(d.marque, ''), '');
  v_vehicle_modele := COALESCE(NULLIF(d.vehicule_modele, ''), NULLIF(d.modele, ''), '');
  v_vehicle_immat := COALESCE(NULLIF(d.vehicule_immatriculation, ''), NULLIF(d.immatriculation, ''), '');
  v_vehicle_energy := COALESCE(NULLIF(d.vehicule_energie, ''), NULLIF(d.carburant, ''), '');
  v_contact_depart_nom := NULLIF(d.contact_depart_nom, '');
  v_contact_depart_tel := NULLIF(d.contact_depart_tel, '');
  v_contact_depart_note := NULLIF(d.contact_depart_note, '');
  v_contact_arrivee_nom := NULLIF(d.contact_arrivee_nom, '');
  v_contact_arrivee_tel := NULLIF(d.contact_arrivee_tel, '');
  v_contact_arrivee_note := NULLIF(d.contact_arrivee_note, '');

  INSERT INTO public.missions (
    user_id, nom, prenom, email, telephone,
    ville_depart, ville_arrivee, date_prise_en_charge,
    type_trajet, marque, modele, immatriculation, carburant, vin, remarques,
    prix_total, statut, mission_group_id, leg_type, leg_index,
    contact_depart_nom, contact_depart_tel, contact_depart_note,
    contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note
  ) VALUES (
    v_user_id, d.nom, d.prenom, d.email, d.telephone,
    d.depart, d.arrivee, COALESCE(d.date_souhaitee, current_date),
    CASE WHEN v_is_ar THEN 'aller_retour' ELSE 'aller_simple' END,
    v_vehicle_marque, v_vehicle_modele, v_vehicle_immat, v_vehicle_energy, d.vehicule_vin, d.message,
    v_aller, 'en_attente', v_group,
    CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END, 1,
    v_contact_depart_nom, v_contact_depart_tel, v_contact_depart_note,
    v_contact_arrivee_nom, v_contact_arrivee_tel, v_contact_arrivee_note
  ) RETURNING id, numero INTO v_mid, v_num;

  INSERT INTO public.trajets (
    demande_id, depart, arrivee, date_trajet, heure_trajet,
    marque, modele, immatriculation,
    client_nom, client_email, client_telephone,
    prix, prix_client, commission_convoyeur_pct,
    statut, statut_publication, pricing_mode, attribution_mode,
    vehicule_immatriculation, vehicule_vin, vehicule_energie,
    vehicule_type, vehicule_couleur, vehicule_km, vehicule_notes,
    contact_depart_nom, contact_depart_tel, contact_depart_note,
    contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note,
    options_meta, mission_group_id, leg_type, leg_index, type_mission
  ) VALUES (
    d.id, d.depart, d.arrivee, d.date_souhaitee, COALESCE(d.heure_souhaitee, ''),
    v_vehicle_marque, v_vehicle_modele, v_vehicle_immat,
    v_client_nom, d.email, COALESCE(d.telephone, ''),
    v_aller, v_aller, 65,
    'en_attente', 'publie', 'fixe', 'mixte',
    v_vehicle_immat, d.vehicule_vin, v_vehicle_energy,
    d.vehicule_type, d.vehicule_couleur, d.vehicule_km, d.vehicule_notes,
    v_contact_depart_nom, v_contact_depart_tel, v_contact_depart_note,
    v_contact_arrivee_nom, v_contact_arrivee_tel, v_contact_arrivee_note,
    COALESCE(d.options_meta, '{}'::jsonb), v_group,
    CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END, 1, 'livraison'
  ) RETURNING id INTO v_tid;

  mission_id := v_mid;
  leg := CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END;
  numero := v_num;
  RETURN NEXT;

  IF v_is_ar THEN
    INSERT INTO public.missions (
      user_id, nom, prenom, email, telephone,
      ville_depart, ville_arrivee, date_prise_en_charge,
      type_trajet, marque, modele, immatriculation, carburant, vin, remarques,
      prix_total, statut, mission_group_id, leg_type, leg_index,
      contact_depart_nom, contact_depart_tel, contact_depart_note,
      contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note
    ) VALUES (
      v_user_id, d.nom, d.prenom, d.email, d.telephone,
      COALESCE(NULLIF(trim(COALESCE(d.adresse_recuperation_retour, '')), ''), NULLIF(trim(COALESCE(d.depart_retour, '')), ''), d.arrivee),
      COALESCE(NULLIF(trim(COALESCE(d.arrivee_retour, '')), ''), d.depart),
      COALESCE(d.date_retour, d.date_souhaitee, current_date),
      'aller_retour',
      COALESCE(NULLIF(d.marque_retour, ''), v_vehicle_marque),
      COALESCE(NULLIF(d.modele_retour, ''), v_vehicle_modele),
      COALESCE(NULLIF(d.immatriculation_retour, ''), v_vehicle_immat),
      v_vehicle_energy,
      COALESCE(NULLIF(d.vin_retour, ''), d.vehicule_vin),
      d.message,
      v_retour, 'en_attente', v_group, 'retour', 2,
      v_contact_arrivee_nom, v_contact_arrivee_tel, v_contact_arrivee_note,
      v_contact_depart_nom, v_contact_depart_tel, v_contact_depart_note
    ) RETURNING id, numero INTO v_mid, v_num;

    INSERT INTO public.trajets (
      demande_id, depart, arrivee, date_trajet, heure_trajet,
      marque, modele, immatriculation,
      client_nom, client_email, client_telephone,
      prix, prix_client, commission_convoyeur_pct,
      statut, statut_publication, pricing_mode, attribution_mode,
      vehicule_immatriculation, vehicule_vin, vehicule_energie,
      vehicule_type, vehicule_couleur, vehicule_km, vehicule_notes,
      contact_depart_nom, contact_depart_tel, contact_depart_note,
      contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note,
      options_meta, mission_group_id, leg_type, leg_index, type_mission
    ) VALUES (
      d.id,
      COALESCE(NULLIF(trim(COALESCE(d.adresse_recuperation_retour, '')), ''), NULLIF(trim(COALESCE(d.depart_retour, '')), ''), d.arrivee),
      COALESCE(NULLIF(trim(COALESCE(d.arrivee_retour, '')), ''), d.depart),
      COALESCE(d.date_retour, d.date_souhaitee),
      COALESCE(d.heure_retour, ''),
      COALESCE(NULLIF(d.marque_retour, ''), v_vehicle_marque),
      COALESCE(NULLIF(d.modele_retour, ''), v_vehicle_modele),
      COALESCE(NULLIF(d.immatriculation_retour, ''), v_vehicle_immat),
      v_client_nom, d.email, COALESCE(d.telephone, ''),
      v_retour, v_retour, 65,
      'en_attente', 'publie', 'fixe', 'mixte',
      COALESCE(NULLIF(d.immatriculation_retour, ''), v_vehicle_immat),
      COALESCE(NULLIF(d.vin_retour, ''), d.vehicule_vin),
      v_vehicle_energy,
      d.vehicule_type, d.vehicule_couleur, d.vehicule_km, d.vehicule_notes,
      v_contact_arrivee_nom, v_contact_arrivee_tel, v_contact_arrivee_note,
      v_contact_depart_nom, v_contact_depart_tel, v_contact_depart_note,
      COALESCE(d.options_meta, '{}'::jsonb), v_group, 'retour', 2, 'restitution'
    ) RETURNING id INTO v_tid;

    mission_id := v_mid;
    leg := 'retour';
    numero := v_num;
    RETURN NEXT;
  END IF;

  UPDATE public.demandes_convoyage
  SET statut = 'convertie',
      mission_group_id = v_group,
      updated_at = now()
  WHERE id = _demande_id;

  RETURN;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_convert_demande_to_missions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_convert_demande_to_missions(uuid) TO authenticated, service_role;