CREATE OR REPLACE FUNCTION public.devis_is_aller_retour(_option text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT o IN ('aller_retour','aller-retour','aller retour','ar','livraison_restitution')
      OR o LIKE '%aller%retour%'
      OR (o LIKE '%livraison%' AND o LIKE '%restitution%')
  FROM (SELECT lower(trim(COALESCE(_option,''))) AS o) s;
$$;

CREATE OR REPLACE FUNCTION public.admin_convert_devis_to_missions(_devis_id uuid, _converted_by uuid DEFAULT NULL::uuid, _mission_status text DEFAULT 'en_attente'::text)
 RETURNS TABLE(mission_id uuid, leg text, numero text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  d record;
  v_is_ar boolean;
  v_group uuid;
  v_user_id uuid;
  v_org_id uuid;
  v_type_client text;
  v_aller numeric;
  v_retour numeric;
  v_split record;
  v_aller_id uuid;
  v_retour_id uuid;
  v_num text;
  v_status text := COALESCE(NULLIF(_mission_status, ''), 'en_attente');
BEGIN
  SELECT * INTO d
  FROM public.devis
  WHERE id = _devis_id
  FOR UPDATE;

  IF d.id IS NULL THEN
    RAISE EXCEPTION 'Devis introuvable';
  END IF;

  v_is_ar := (
    public.devis_is_aller_retour(d.option_trajet)
    OR (d.depart_retour IS NOT NULL AND length(trim(d.depart_retour)) > 0)
    OR (d.arrivee_retour IS NOT NULL AND length(trim(d.arrivee_retour)) > 0)
    OR d.date_retour IS NOT NULL
    OR (d.immatriculation_retour IS NOT NULL AND length(trim(d.immatriculation_retour)) > 0)
    OR (d.vin_retour IS NOT NULL AND length(trim(d.vin_retour)) > 0)
    OR COALESCE(d.prix_retour, 0) > 0
  );

  v_user_id := d.user_id;
  IF v_user_id IS NULL THEN
    SELECT user_id, organization_id, type_client
    INTO v_user_id, v_org_id, v_type_client
    FROM public.profiles
    WHERE lower(email) = lower(COALESCE(d.email, ''))
      AND user_id IS NOT NULL
    LIMIT 1;
  ELSE
    SELECT organization_id, type_client
    INTO v_org_id, v_type_client
    FROM public.profiles
    WHERE user_id = v_user_id
    LIMIT 1;
  END IF;

  v_user_id := COALESCE(v_user_id, _converted_by);
  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id
    FROM public.user_roles
    WHERE role IN ('admin', 'super_admin')
    LIMIT 1;
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur de rattachement introuvable';
  END IF;

  v_group := COALESCE(d.mission_group_id, (SELECT mission_group_id FROM public.missions WHERE id = d.mission_id), gen_random_uuid());

  IF v_is_ar THEN
    IF COALESCE(d.prix_aller, 0) > 0 AND COALESCE(d.prix_retour, 0) > 0 THEN
      v_aller := d.prix_aller;
      v_retour := d.prix_retour;
    ELSE
      SELECT * INTO v_split FROM public.split_ar_prices(COALESCE(d.prix_estime, d.total_ttc, 0));
      v_aller := v_split.aller;
      v_retour := v_split.retour;
    END IF;
  ELSE
    v_aller := COALESCE(d.prix_estime, d.total_ttc, 0);
    v_retour := 0;
  END IF;

  SELECT id INTO v_aller_id
  FROM public.missions
  WHERE devis_id = d.id
     OR id = d.mission_id
  ORDER BY CASE WHEN COALESCE(leg_type, 'simple') IN ('aller', 'simple') THEN 0 ELSE 1 END, created_at
  LIMIT 1;

  IF v_aller_id IS NULL THEN
    INSERT INTO public.missions (
      devis_id, user_id, organization_id, fleet_organization_id,
      nom, prenom, email, telephone,
      ville_depart, ville_arrivee, date_prise_en_charge,
      type_trajet, marque, modele, carburant, vin, remarques,
      prix_total, statut, mission_group_id, leg_type, leg_index,
      contact_depart_nom, contact_depart_tel, contact_depart_note,
      contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note
    ) VALUES (
      d.id, v_user_id, v_org_id, CASE WHEN v_type_client = 'flotte' THEN v_org_id ELSE NULL END,
      COALESCE(d.nom, ''), COALESCE(d.prenom, ''), COALESCE(d.email, ''), d.telephone,
      d.depart, d.arrivee, COALESCE(d.date_souhaitee, current_date),
      CASE WHEN v_is_ar THEN 'aller_retour' ELSE 'aller_simple' END,
      d.marque, d.modele, d.carburant, d.vin, d.message,
      v_aller, v_status, v_group, CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END, 1,
      d.contact_depart_nom, d.contact_depart_tel, d.contact_depart_note,
      d.contact_arrivee_nom, d.contact_arrivee_tel, d.contact_arrivee_note
    ) RETURNING missions.id, missions.numero INTO v_aller_id, v_num;
  ELSE
    UPDATE public.missions AS m
    SET devis_id = d.id,
        organization_id = COALESCE(m.organization_id, v_org_id),
        fleet_organization_id = COALESCE(m.fleet_organization_id, CASE WHEN v_type_client = 'flotte' THEN v_org_id ELSE NULL END),
        mission_group_id = v_group,
        type_trajet = CASE WHEN v_is_ar THEN 'aller_retour' ELSE 'aller_simple' END,
        leg_type = CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END,
        leg_index = 1,
        prix_total = CASE WHEN COALESCE(m.prix_locked, false) THEN m.prix_total ELSE v_aller END,
        updated_at = now()
    WHERE m.id = v_aller_id
    RETURNING m.numero INTO v_num;
  END IF;

  mission_id := v_aller_id;
  leg := CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END;
  numero := v_num;
  RETURN NEXT;

  IF v_is_ar THEN
    SELECT id INTO v_retour_id
    FROM public.missions
    WHERE devis_id = d.id AND leg_type = 'retour'
    LIMIT 1;

    IF v_retour_id IS NULL THEN
      INSERT INTO public.missions (
        devis_id, user_id, organization_id, fleet_organization_id,
        nom, prenom, email, telephone,
        ville_depart, ville_arrivee, date_prise_en_charge,
        type_trajet, marque, modele, carburant, vin, remarques,
        prix_total, statut, mission_group_id, leg_type, leg_index,
        contact_depart_nom, contact_depart_tel, contact_depart_note,
        contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note
      ) VALUES (
        d.id, v_user_id, v_org_id, CASE WHEN v_type_client = 'flotte' THEN v_org_id ELSE NULL END,
        COALESCE(d.nom, ''), COALESCE(d.prenom, ''), COALESCE(d.email, ''), d.telephone,
        CASE WHEN COALESCE(d.recuperation_retour_identique, true) THEN d.arrivee ELSE COALESCE(NULLIF(trim(COALESCE(d.adresse_recuperation_retour, '')), ''), d.depart_retour, d.arrivee) END,
        COALESCE(NULLIF(trim(COALESCE(d.arrivee_retour, '')), ''), d.depart),
        COALESCE(d.date_retour, d.date_souhaitee, current_date),
        'aller_retour', COALESCE(d.marque_retour, d.marque), COALESCE(d.modele_retour, d.modele), d.carburant, COALESCE(d.vin_retour, d.vin), d.message,
        v_retour, v_status, v_group, 'retour', 2,
        d.contact_arrivee_nom, d.contact_arrivee_tel, d.contact_arrivee_note,
        d.contact_depart_nom, d.contact_depart_tel, d.contact_depart_note
      ) RETURNING missions.id, missions.numero INTO v_retour_id, v_num;
    ELSE
      UPDATE public.missions AS m
      SET devis_id = d.id,
          organization_id = COALESCE(m.organization_id, v_org_id),
          fleet_organization_id = COALESCE(m.fleet_organization_id, CASE WHEN v_type_client = 'flotte' THEN v_org_id ELSE NULL END),
          mission_group_id = v_group,
          type_trajet = 'aller_retour',
          leg_type = 'retour',
          leg_index = 2,
          prix_total = CASE WHEN COALESCE(m.prix_locked, false) THEN m.prix_total ELSE v_retour END,
          updated_at = now()
      WHERE m.id = v_retour_id
      RETURNING m.numero INTO v_num;
    END IF;

    mission_id := v_retour_id;
    leg := 'retour';
    numero := v_num;
    RETURN NEXT;
  END IF;

  UPDATE public.devis
  SET statut = 'convertit',
      mission_id = v_aller_id,
      mission_group_id = v_group,
      converted_at = COALESCE(converted_at, now()),
      converted_by = COALESCE(converted_by, _converted_by),
      updated_at = now()
  WHERE id = d.id;

  RETURN;
END;
$function$;