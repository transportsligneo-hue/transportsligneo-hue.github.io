-- 1) Fix duo conversion: add return leg at 50% instead of splitting
CREATE OR REPLACE FUNCTION public.admin_convert_mission_to_duo(_trajet_id uuid, _depart text DEFAULT NULL::text, _arrivee text DEFAULT NULL::text, _date date DEFAULT NULL::date, _heure text DEFAULT NULL::text, _immatriculation text DEFAULT NULL::text, _vin text DEFAULT NULL::text, _marque text DEFAULT NULL::text, _modele text DEFAULT NULL::text, _prix_retour numeric DEFAULT NULL::numeric, _split_prix boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t public.trajets%ROWTYPE;
  v_group uuid;
  v_base text;
  v_aller numeric;
  v_retour numeric;
  v_new uuid;
  v_mission_aller uuid;
  v_mission_retour uuid;
  v_immat text;
  v_vin text;
  v_marque text;
  v_modele text;
  v_depart text;
  v_arrivee text;
  v_date date;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT * INTO t FROM public.trajets WHERE id = _trajet_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Mission introuvable'; END IF;

  IF t.mission_group_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.trajets x
     WHERE x.mission_group_id = t.mission_group_id AND x.id <> t.id
       AND (x.leg_type IN ('aller','retour') OR x.leg_index = 2)
  ) THEN
    RAISE EXCEPTION 'Ce dossier possède déjà un volet Livraison + Restitution';
  END IF;

  v_group := COALESCE(t.mission_group_id, gen_random_uuid());
  v_base := btrim(regexp_replace(COALESCE(t.numero_mission, ''), '\s*[-–]?\s*(L|R|A)$', '', 'i'));

  v_aller := round(COALESCE(t.prix, 0), 2);
  IF _prix_retour IS NOT NULL THEN
    v_retour := round(GREATEST(_prix_retour, 0), 2);
  ELSE
    v_retour := round(v_aller * 0.5, 2);
  END IF;

  v_depart  := COALESCE(NULLIF(btrim(COALESCE(_depart, '')), ''), t.arrivee);
  v_arrivee := COALESCE(NULLIF(btrim(COALESCE(_arrivee, '')), ''), t.depart);
  v_date    := COALESCE(_date, t.date_trajet);
  v_immat   := COALESCE(NULLIF(upper(btrim(COALESCE(_immatriculation, ''))), ''), t.immatriculation);
  v_vin     := COALESCE(NULLIF(upper(btrim(COALESCE(_vin, ''))), ''), t.vin);
  v_marque  := COALESCE(NULLIF(btrim(COALESCE(_marque, '')), ''), t.marque);
  v_modele  := COALESCE(NULLIF(btrim(COALESCE(_modele, '')), ''), t.modele);

  UPDATE public.trajets SET
    mission_group_id = v_group,
    leg_type = 'aller',
    leg_index = 1,
    is_round_trip = true,
    prix = v_aller,
    prix_client = v_aller,
    numero_mission = CASE WHEN v_base <> '' THEN v_base || '-L' ELSE numero_mission END,
    updated_at = now()
  WHERE id = t.id;

  UPDATE public.attributions SET
    numero_mission = CASE WHEN v_base <> '' THEN v_base || '-L' ELSE numero_mission END,
    updated_at = now()
  WHERE trajet_id = t.id;

  INSERT INTO public.trajets (
    depart, arrivee, date_trajet, heure_trajet, date_souhaitee,
    marque, modele, immatriculation, vin,
    client_nom, client_telephone, client_email,
    prix, prix_client, statut, statut_publication,
    devis_id, demande_id, mission_id,
    mission_group_id, leg_type, leg_index, is_round_trip,
    numero_mission, type_mission, commande_ref, options_meta,
    vehicule_immatriculation, vehicule_vin, vehicule_energie, vehicule_type,
    contact_depart_nom, contact_depart_tel, contact_depart_note,
    contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note,
    arrivee_contact_nom, arrivee_contact_prenom, arrivee_contact_societe,
    arrivee_contact_telephone, arrivee_contact_telephone2, arrivee_contact_instructions,
    arrivee_contact_email, niveau_requis, pricing_mode
  )
  VALUES (
    v_depart, v_arrivee, v_date, COALESCE(NULLIF(_heure, ''), t.heure_trajet), v_date,
    v_marque, v_modele, v_immat, v_vin,
    t.client_nom, t.client_telephone, t.client_email,
    v_retour, v_retour, 'en_attente', 'brouillon',
    t.devis_id, t.demande_id, t.mission_id,
    v_group, 'retour', 2, true,
    CASE WHEN v_base <> '' THEN v_base || '-R' ELSE NULL END, t.type_mission, t.commande_ref, t.options_meta,
    v_immat, v_vin, t.vehicule_energie, t.vehicule_type,
    t.contact_arrivee_nom, t.contact_arrivee_tel, t.contact_arrivee_note,
    t.contact_depart_nom, t.contact_depart_tel, t.contact_depart_note,
    t.arrivee_contact_nom, t.arrivee_contact_prenom, t.arrivee_contact_societe,
    t.arrivee_contact_telephone, t.arrivee_contact_telephone2, t.arrivee_contact_instructions,
    t.arrivee_contact_email, t.niveau_requis, t.pricing_mode
  )
  RETURNING id INTO v_new;

  SELECT id INTO v_mission_aller FROM public.missions m
   WHERE (t.devis_id IS NOT NULL AND m.devis_id = t.devis_id)
      OR m.mission_group_id = v_group
   ORDER BY CASE WHEN COALESCE(m.leg_type, 'simple') IN ('aller', 'simple') THEN 0 ELSE 1 END, m.created_at
   LIMIT 1;

  IF v_mission_aller IS NOT NULL THEN
    UPDATE public.missions SET
      mission_group_id = v_group, type_trajet = 'aller_retour',
      leg_type = 'aller', leg_index = 1, prix_total = v_aller, updated_at = now()
    WHERE id = v_mission_aller;

    SELECT id INTO v_mission_retour FROM public.missions
     WHERE mission_group_id = v_group AND (leg_type = 'retour' OR leg_index = 2) LIMIT 1;

    IF v_mission_retour IS NULL THEN
      INSERT INTO public.missions (
        numero, devis_id, user_id, organization_id, fleet_organization_id,
        nom, prenom, email, telephone, ville_depart, ville_arrivee, date_prise_en_charge,
        type_trajet, marque, modele, carburant, vin, immatriculation, remarques, prix_total, statut,
        mission_group_id, leg_type, leg_index,
        contact_depart_nom, contact_depart_tel, contact_depart_note,
        contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note
      )
      SELECT
        m.numero, m.devis_id, m.user_id, m.organization_id, m.fleet_organization_id,
        m.nom, m.prenom, m.email, m.telephone, v_depart, v_arrivee, COALESCE(v_date, m.date_prise_en_charge),
        'aller_retour', v_marque, v_modele, m.carburant, v_vin, v_immat, m.remarques, v_retour, m.statut,
        v_group, 'retour', 2,
        m.contact_arrivee_nom, m.contact_arrivee_tel, m.contact_arrivee_note,
        m.contact_depart_nom, m.contact_depart_tel, m.contact_depart_note
      FROM public.missions m WHERE m.id = v_mission_aller;
    END IF;
  END IF;

  IF t.devis_id IS NOT NULL THEN
    UPDATE public.devis SET
      option_trajet = 'aller_retour',
      prix_aller = v_aller,
      prix_retour = v_retour,
      depart_retour = COALESCE(NULLIF(btrim(COALESCE(depart_retour, '')), ''), v_depart),
      arrivee_retour = COALESCE(NULLIF(btrim(COALESCE(arrivee_retour, '')), ''), v_arrivee),
      date_retour = COALESCE(date_retour, v_date),
      immatriculation_retour = COALESCE(NULLIF(btrim(COALESCE(immatriculation_retour, '')), ''), v_immat),
      vin_retour = COALESCE(NULLIF(btrim(COALESCE(vin_retour, '')), ''), v_vin),
      mission_group_id = COALESCE(mission_group_id, v_group),
      updated_at = now()
    WHERE id = t.devis_id;
  END IF;

  RETURN v_new;
END;
$function$;

-- 2) Cleanup dossier #081 : 3 volets -> 2 (120 + 60)
UPDATE public.trajets SET parent_trajet_id = NULL
 WHERE parent_trajet_id IN ('8f71aa1f-8f89-4fcf-903b-23584153d7ac','7cdb82f7-57a3-4611-87da-2b1a3247da10');
DELETE FROM public.trajets WHERE id = '8f71aa1f-8f89-4fcf-903b-23584153d7ac';
UPDATE public.trajets SET leg_type = 'aller', leg_index = 1, is_round_trip = true,
  prix = 120, prix_client = 120, numero_mission = 'MIS-TLG-2026-#081-L', updated_at = now()
 WHERE id = '64819cea-e488-4231-b847-35684f8987f6';
UPDATE public.trajets SET leg_type = 'retour', leg_index = 2, is_round_trip = true,
  prix = 60, prix_client = 60, numero_mission = 'MIS-TLG-2026-#081-R', updated_at = now()
 WHERE id = '7e5f0570-d064-4f57-8454-306f44777e1a';
UPDATE public.devis SET option_trajet = 'aller_retour', prix_aller = 120, prix_retour = 60, updated_at = now()
 WHERE id = 'f3b6604f-d83c-4475-971b-1448db62e9c8';

-- 3) Cleanup dossier #084 : suppression du volet annulé en double
DELETE FROM public.trajets WHERE id = '7cdb82f7-57a3-4611-87da-2b1a3247da10';
UPDATE public.trajets SET leg_type = 'aller', leg_index = 1, is_round_trip = true,
  prix = 70, prix_client = 70, numero_mission = 'MIS-TLG-2026-#084-L', updated_at = now()
 WHERE id = '33be055a-8bab-4446-9342-fd6bc74ebb22';
UPDATE public.trajets SET leg_type = 'retour', leg_index = 2, is_round_trip = true,
  prix = 35, prix_client = 35, numero_mission = 'MIS-TLG-2026-#084-R', updated_at = now()
 WHERE id = 'b0ebd651-ba30-4cbc-b0c7-cb9e946fb44d';
UPDATE public.attributions a SET numero_mission = t.numero_mission, updated_at = now()
 FROM public.trajets t WHERE a.trajet_id = t.id
   AND t.id IN ('64819cea-e488-4231-b847-35684f8987f6','7e5f0570-d064-4f57-8454-306f44777e1a','33be055a-8bab-4446-9342-fd6bc74ebb22','b0ebd651-ba30-4cbc-b0c7-cb9e946fb44d');