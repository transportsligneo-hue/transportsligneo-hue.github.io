CREATE OR REPLACE FUNCTION public.admin_convert_demande_to_missions(_demande_id uuid)
RETURNS TABLE(mission_id uuid, leg text, numero text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  d public.demandes_convoyage%ROWTYPE;
  v_group uuid;
  v_user_id uuid;
  v_is_ar boolean;
  v_total numeric;
  v_aller numeric;
  v_retour numeric;
  v_mission_aller uuid;
  v_mission_retour uuid;
  v_numero_aller text;
  v_numero_retour text;
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
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Accès admin requis' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO d
  FROM public.demandes_convoyage
  WHERE id = _demande_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable';
  END IF;

  IF d.mission_group_id IS NOT NULL THEN
    RETURN QUERY
    SELECT m.id,
           COALESCE(m.leg_type, 'simple'::text),
           m.numero::text
    FROM public.missions AS m
    WHERE m.mission_group_id = d.mission_group_id
    ORDER BY m.leg_index NULLS LAST, m.created_at;
    RETURN;
  END IF;

  IF d.devis_id IS NOT NULL THEN
    RETURN QUERY
    SELECT m.id,
           COALESCE(m.leg_type, 'simple'::text),
           m.numero::text
    FROM public.missions AS m
    WHERE m.devis_id = d.devis_id
    ORDER BY m.leg_index NULLS LAST, m.created_at;
    IF FOUND THEN RETURN; END IF;
  END IF;

  v_user_id := d.user_id;
  v_is_ar := lower(COALESCE(d.options, '')) IN ('aller-retour', 'aller_retour', 'livraison + restitution', 'livraison+restitution')
    OR d.depart_retour IS NOT NULL OR d.arrivee_retour IS NOT NULL OR d.date_retour IS NOT NULL;
  v_group := gen_random_uuid();
  v_total := COALESCE(d.prix_estime, 0);

  SELECT s.aller, s.retour INTO v_aller, v_retour
  FROM public.split_ar_prices(v_total) AS s;
  IF NOT v_is_ar THEN v_aller := v_total; v_retour := 0; END IF;

  v_vehicle_marque := COALESCE(d.vehicule_marque, d.marque);
  v_vehicle_modele := COALESCE(d.vehicule_modele, d.modele);
  v_vehicle_immat := COALESCE(d.vehicule_immatriculation, d.immatriculation);
  v_vehicle_energy := COALESCE(d.vehicule_energie, d.carburant);
  v_contact_depart_nom := d.contact_depart_nom;
  v_contact_depart_tel := d.contact_depart_tel;
  v_contact_depart_note := d.contact_depart_note;
  v_contact_arrivee_nom := d.contact_arrivee_nom;
  v_contact_arrivee_tel := d.contact_arrivee_tel;
  v_contact_arrivee_note := d.contact_arrivee_note;

  INSERT INTO public.missions AS new_mission (
    user_id, nom, prenom, email, telephone,
    ville_depart, ville_arrivee, date_prise_en_charge,
    type_trajet, marque, modele, immatriculation, carburant, vin, remarques,
    prix_total, statut, mission_group_id, leg_type, leg_index,
    contact_depart_nom, contact_depart_tel, contact_depart_note,
    contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note,
    devis_id
  ) VALUES (
    v_user_id, d.nom, d.prenom, d.email, d.telephone,
    d.depart, d.arrivee, COALESCE(d.date_souhaitee, current_date),
    CASE WHEN v_is_ar THEN 'aller_retour' ELSE 'aller_simple' END,
    v_vehicle_marque, v_vehicle_modele, v_vehicle_immat, v_vehicle_energy, d.vehicule_vin, d.message,
    v_aller, 'en_attente', v_group,
    CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END, 1,
    v_contact_depart_nom, v_contact_depart_tel, v_contact_depart_note,
    v_contact_arrivee_nom, v_contact_arrivee_tel, v_contact_arrivee_note,
    d.devis_id
  ) RETURNING new_mission.id, new_mission.numero INTO v_mission_aller, v_numero_aller;

  INSERT INTO public.trajets (
    demande_id, mission_id, devis_id, depart, arrivee, date_souhaitee,
    prix_total, statut, statut_publication, attribution_mode, type_mission,
    mission_group_id, group_reference, leg_type, leg_index, is_round_trip
  ) VALUES (
    d.id, v_mission_aller, d.devis_id, d.depart, d.arrivee, d.date_souhaitee,
    v_aller, 'en_attente', 'publie', 'mixte',
    CASE WHEN v_is_ar THEN 'aller_retour' ELSE 'livraison' END,
    v_group, d.group_reference,
    CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END, 1, v_is_ar
  );

  IF v_is_ar THEN
    INSERT INTO public.missions AS new_return_mission (
      user_id, nom, prenom, email, telephone,
      ville_depart, ville_arrivee, date_prise_en_charge,
      type_trajet, marque, modele, immatriculation, carburant, vin, remarques,
      prix_total, statut, mission_group_id, leg_type, leg_index,
      contact_depart_nom, contact_depart_tel, contact_depart_note,
      contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note,
      devis_id
    ) VALUES (
      v_user_id, d.nom, d.prenom, d.email, d.telephone,
      COALESCE(d.depart_retour, d.arrivee), COALESCE(d.arrivee_retour, d.depart), COALESCE(d.date_retour, d.date_souhaitee, current_date),
      'aller_retour', COALESCE(d.marque_retour, v_vehicle_marque), COALESCE(d.modele_retour, v_vehicle_modele),
      COALESCE(d.immatriculation_retour, v_vehicle_immat), v_vehicle_energy, COALESCE(d.vin_retour, d.vehicule_vin), d.message,
      v_retour, 'en_attente', v_group, 'retour', 2,
      v_contact_arrivee_nom, v_contact_arrivee_tel, v_contact_arrivee_note,
      v_contact_depart_nom, v_contact_depart_tel, v_contact_depart_note,
      d.devis_id
    ) RETURNING new_return_mission.id, new_return_mission.numero INTO v_mission_retour, v_numero_retour;

    INSERT INTO public.trajets (
      demande_id, mission_id, devis_id, depart, arrivee, date_souhaitee,
      prix_total, statut, statut_publication, attribution_mode, type_mission,
      mission_group_id, group_reference, leg_type, leg_index, is_round_trip
    ) VALUES (
      d.id, v_mission_retour, d.devis_id,
      COALESCE(d.depart_retour, d.arrivee), COALESCE(d.arrivee_retour, d.depart), COALESCE(d.date_retour, d.date_souhaitee),
      v_retour, 'en_attente', 'publie', 'mixte', 'aller_retour',
      v_group, d.group_reference, 'retour', 2, true
    );
  END IF;

  UPDATE public.demandes_convoyage
  SET statut = 'convertie', mission_group_id = v_group, updated_at = now()
  WHERE id = d.id;

  UPDATE public.devis
  SET statut = 'convertit', mission_id = v_mission_aller, updated_at = now()
  WHERE id = d.devis_id;

  RETURN QUERY SELECT v_mission_aller, CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END, v_numero_aller;
  IF v_is_ar THEN
    RETURN QUERY SELECT v_mission_retour, 'retour'::text, v_numero_retour;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_convert_demande_to_missions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_convert_demande_to_missions(uuid) TO authenticated, service_role;