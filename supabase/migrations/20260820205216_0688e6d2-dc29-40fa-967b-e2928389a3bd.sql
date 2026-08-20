CREATE OR REPLACE FUNCTION public.admin_rename_mission_numero(_attribution_id uuid, _numero text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_raw text := btrim(_numero);
  v_base text;
  v_trajet uuid;
  v_group uuid;
  v_devis uuid;
  v_duo boolean := false;
  v_num text;
  v_fac text;
  v_dev text;
  r record;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  IF v_raw IS NULL OR v_raw = '' THEN RAISE EXCEPTION 'Numéro requis'; END IF;
  IF v_raw !~ '^[A-Za-z0-9 #._/-]+$' THEN RAISE EXCEPTION 'Caractères non autorisés'; END IF;

  v_base := btrim(regexp_replace(v_raw, '\s*[-–]?\s*(L|R|A)$', '', 'i'));

  SELECT trajet_id INTO v_trajet FROM public.attributions WHERE id = _attribution_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mission introuvable'; END IF;

  IF v_trajet IS NOT NULL THEN
    SELECT mission_group_id, devis_id INTO v_group, v_devis FROM public.trajets WHERE id = v_trajet;
  END IF;

  SELECT count(*) > 1 INTO v_duo
  FROM public.trajets t
  WHERE t.id = v_trajet
     OR (v_group IS NOT NULL AND t.mission_group_id = v_group)
     OR (v_devis IS NOT NULL AND t.devis_id = v_devis);

  UPDATE public.attributions SET numero_mission = v_base, updated_at = now() WHERE id = _attribution_id;

  FOR r IN
    SELECT t.id, t.leg_type, t.leg_index
    FROM public.trajets t
    WHERE t.id = v_trajet
       OR (v_group IS NOT NULL AND t.mission_group_id = v_group)
       OR (v_devis IS NOT NULL AND t.devis_id = v_devis)
  LOOP
    v_num := v_base || CASE
      WHEN NOT v_duo THEN ''
      WHEN r.leg_type = 'retour' OR r.leg_index = 2 THEN '-R'
      ELSE '-L'
    END;
    UPDATE public.trajets SET numero_mission = v_num, updated_at = now() WHERE id = r.id;
    UPDATE public.attributions SET numero_mission = v_num, updated_at = now() WHERE trajet_id = r.id;
  END LOOP;

  -- Table missions (miroir)
  IF v_group IS NOT NULL OR v_devis IS NOT NULL THEN
    UPDATE public.missions m SET numero = v_base, updated_at = now()
     WHERE (v_group IS NOT NULL AND m.mission_group_id = v_group)
        OR (v_devis IS NOT NULL AND m.devis_id = v_devis);
  END IF;

  -- Facture liée : MIS-TLG-YYYY-#NNN -> FAC-TLG-YYYY-#NNN
  IF v_base ~ '^MIS-TLG-[0-9]{4}-#?[0-9]{3,}$' THEN
    v_fac := regexp_replace(v_base, '^MIS-', 'FAC-');
    UPDATE public.factures f
       SET numero = v_fac
     WHERE (
        f.attribution_id IN (
          SELECT a.id FROM public.attributions a
           WHERE a.id = _attribution_id
              OR a.trajet_id IN (
                SELECT t.id FROM public.trajets t
                 WHERE t.id = v_trajet
                    OR (v_group IS NOT NULL AND t.mission_group_id = v_group)
                    OR (v_devis IS NOT NULL AND t.devis_id = v_devis)
              )
        )
        OR f.mission_id IN (
          SELECT t.id FROM public.trajets t
           WHERE t.id = v_trajet
              OR (v_group IS NOT NULL AND t.mission_group_id = v_group)
              OR (v_devis IS NOT NULL AND t.devis_id = v_devis)
        )
       )
       AND f.numero IS DISTINCT FROM v_fac
       AND NOT EXISTS (SELECT 1 FROM public.factures f2 WHERE f2.numero = v_fac AND f2.id <> f.id);

    -- Devis d'origine : MIS-TLG-YYYY-#NNN -> DEV-TLG-YYYY-#NNN
    IF v_devis IS NOT NULL THEN
      v_dev := regexp_replace(v_base, '^MIS-', 'DEV-');
      UPDATE public.devis d
         SET numero = v_dev, updated_at = now()
       WHERE d.id = v_devis
         AND d.numero IS DISTINCT FROM v_dev
         AND NOT EXISTS (SELECT 1 FROM public.devis d2 WHERE d2.numero = v_dev AND d2.id <> d.id);
    END IF;
  END IF;

  RETURN v_base;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_convert_mission_to_duo(
  _trajet_id uuid,
  _depart text DEFAULT NULL,
  _arrivee text DEFAULT NULL,
  _date date DEFAULT NULL,
  _heure text DEFAULT NULL,
  _immatriculation text DEFAULT NULL,
  _vin text DEFAULT NULL,
  _marque text DEFAULT NULL,
  _modele text DEFAULT NULL,
  _prix_retour numeric DEFAULT NULL,
  _split_prix boolean DEFAULT true
)
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
  v_split record;
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
       AND (x.leg_type = 'retour' OR x.leg_index = 2)
  ) THEN
    RAISE EXCEPTION 'Cette mission possède déjà un volet retour';
  END IF;

  v_group := COALESCE(t.mission_group_id, gen_random_uuid());
  v_base := btrim(regexp_replace(COALESCE(t.numero_mission, ''), '\s*[-–]?\s*(L|R|A)$', '', 'i'));

  IF _prix_retour IS NOT NULL THEN
    v_retour := round(GREATEST(_prix_retour, 0), 2);
    v_aller := round(COALESCE(t.prix, 0), 2);
  ELSIF COALESCE(_split_prix, true) THEN
    SELECT * INTO v_split FROM public.split_ar_prices(COALESCE(t.prix, 0));
    v_aller := v_split.aller; v_retour := v_split.retour;
  ELSE
    v_aller := round(COALESCE(t.prix, 0), 2); v_retour := 0;
  END IF;

  v_depart  := COALESCE(NULLIF(btrim(COALESCE(_depart, '')), ''), t.arrivee);
  v_arrivee := COALESCE(NULLIF(btrim(COALESCE(_arrivee, '')), ''), t.depart);
  v_date    := COALESCE(_date, t.date_trajet);
  v_immat   := COALESCE(NULLIF(upper(btrim(COALESCE(_immatriculation, ''))), ''), t.immatriculation);
  v_vin     := COALESCE(NULLIF(upper(btrim(COALESCE(_vin, ''))), ''), t.vin);
  v_marque  := COALESCE(NULLIF(btrim(COALESCE(_marque, '')), ''), t.marque);
  v_modele  := COALESCE(NULLIF(btrim(COALESCE(_modele, '')), ''), t.modele);

  -- Volet Livraison (existant)
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

  -- Volet Restitution (nouveau trajet)
  INSERT INTO public.trajets (
    depart, arrivee, date_trajet, heure_trajet, date_souhaitee,
    marque, modele, immatriculation, vin,
    client_nom, client_telephone, client_email,
    prix, prix_client, statut, statut_publication,
    devis_id, demande_id, mission_id, organization_id_placeholder_ignore,
    mission_group_id, leg_type, leg_index, is_round_trip,
    numero_mission, type_mission, commande_ref, options_meta,
    vehicule_immatriculation, vehicule_vin, vehicule_energie, vehicule_type,
    contact_depart_nom, contact_depart_tel, contact_depart_note,
    contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note,
    arrivee_contact_nom, arrivee_contact_prenom, arrivee_contact_societe,
    arrivee_contact_telephone, arrivee_contact_telephone2, arrivee_contact_instructions,
    arrivee_contact_email, niveau_requis, pricing_mode
  )
  SELECT
    v_depart, v_arrivee, v_date, COALESCE(NULLIF(_heure, ''), t.heure_trajet), v_date,
    v_marque, v_modele, v_immat, v_vin,
    t.client_nom, t.client_telephone, t.client_email,
    v_retour, v_retour, 'en_attente', 'brouillon',
    t.devis_id, t.demande_id, t.mission_id, NULL,
    v_group, 'retour', 2, true,
    CASE WHEN v_base <> '' THEN v_base || '-R' ELSE NULL END, t.type_mission, t.commande_ref, t.options_meta,
    v_immat, v_vin, t.vehicule_energie, t.vehicule_type,
    t.contact_arrivee_nom, t.contact_arrivee_tel, t.contact_arrivee_note,
    t.contact_depart_nom, t.contact_depart_tel, t.contact_depart_note,
    t.arrivee_contact_nom, t.arrivee_contact_prenom, t.arrivee_contact_societe,
    t.arrivee_contact_telephone, t.arrivee_contact_telephone2, t.arrivee_contact_instructions,
    t.arrivee_contact_email, t.niveau_requis, t.pricing_mode
  RETURNING id INTO v_new;

  -- Miroir table missions
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

  -- Devis d'origine remis en aller-retour
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

GRANT EXECUTE ON FUNCTION public.admin_convert_mission_to_duo(uuid, text, text, date, text, text, text, text, text, numeric, boolean) TO authenticated;