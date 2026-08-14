ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS immatriculation text;

CREATE TABLE IF NOT EXISTS public.admin_table_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  table_key text NOT NULL,
  hidden_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, table_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_table_prefs TO authenticated;
GRANT ALL ON public.admin_table_prefs TO service_role;

ALTER TABLE public.admin_table_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own table prefs"
ON public.admin_table_prefs FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_admin_table_prefs_updated_at
BEFORE UPDATE ON public.admin_table_prefs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.admin_assign_convoyeur(_trajet_id uuid, _convoyeur_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_trajet record;
  v_convoyeur_user uuid;
  v_attr_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_trajet FROM public.trajets WHERE id = _trajet_id FOR UPDATE;
  IF v_trajet.id IS NULL THEN RAISE EXCEPTION 'Trajet introuvable'; END IF;

  SELECT user_id INTO v_convoyeur_user FROM public.convoyeurs WHERE id = _convoyeur_id AND statut = 'valide';
  IF v_convoyeur_user IS NULL THEN RAISE EXCEPTION 'Convoyeur non validé'; END IF;

  -- Réaffectation : on annule les attributions actives qui ne sont pas déjà en cours de réalisation
  UPDATE public.attributions
     SET statut = 'annule', statut_convoyeur = 'annule', updated_at = now()
   WHERE trajet_id = _trajet_id
     AND statut IN ('propose','accepte','en_attente_validation')
     AND convoyeur_id <> _convoyeur_id;

  IF EXISTS (SELECT 1 FROM public.attributions WHERE trajet_id = _trajet_id AND statut = 'en_cours') THEN
    RAISE EXCEPTION 'Mission déjà démarrée : réaffectation impossible';
  END IF;

  SELECT id INTO v_attr_id FROM public.attributions
   WHERE trajet_id = _trajet_id AND convoyeur_id = _convoyeur_id
     AND statut NOT IN ('annule','termine')
   LIMIT 1;

  IF v_attr_id IS NULL THEN
    INSERT INTO public.attributions (trajet_id, convoyeur_id, statut, mode, statut_convoyeur, is_public, numero_mission)
    VALUES (_trajet_id, _convoyeur_id, 'accepte', 'directe', 'en_attente', false, v_trajet.numero_mission)
    RETURNING id INTO v_attr_id;
  ELSE
    UPDATE public.attributions
       SET statut = 'accepte', updated_at = now()
     WHERE id = v_attr_id;
  END IF;

  UPDATE public.trajets
     SET statut = CASE WHEN statut IN ('en_cours','termine') THEN statut ELSE 'attribue' END,
         statut_publication = 'attribue',
         updated_at = now()
   WHERE id = _trajet_id;

  PERFORM public.create_user_notification(
    v_convoyeur_user, 'mission_attribuee', 'Mission attribuée',
    'Une mission vous a été attribuée par l''équipe Ligneo.',
    '/convoyeur/missions', 'mission', 'high',
    'assign:' || v_attr_id::text, 'attribution', v_attr_id,
    jsonb_build_object('trajet_id', _trajet_id, 'depart', v_trajet.depart, 'arrivee', v_trajet.arrivee)
  );

  RETURN v_attr_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_assign_convoyeur(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_convoyeur(uuid, uuid) TO authenticated, service_role;

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
  v_target_num text;
  v_immat_aller text;
  v_immat_retour text;
  v_vin_aller text;
  v_vin_retour text;
BEGIN
  SELECT * INTO d FROM public.devis WHERE id = _devis_id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Devis introuvable'; END IF;

  v_target_num := regexp_replace(d.numero, '^DEV-TLG-', 'MIS-TLG-');
  IF v_target_num !~ '^MIS-TLG-[0-9]{4}-#?[0-9]{3,}$' THEN
    RAISE EXCEPTION 'Numéro de devis invalide pour conversion: %', d.numero;
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

  v_immat_aller  := NULLIF(trim(COALESCE(d.immatriculation, '')), '');
  v_immat_retour := COALESCE(NULLIF(trim(COALESCE(d.immatriculation_retour, '')), ''), v_immat_aller);
  v_vin_aller    := NULLIF(trim(COALESCE(d.vin, '')), '');
  v_vin_retour   := COALESCE(NULLIF(trim(COALESCE(d.vin_retour, '')), ''), v_vin_aller);

  v_user_id := d.user_id;
  IF v_user_id IS NULL THEN
    SELECT user_id, organization_id, type_client INTO v_user_id, v_org_id, v_type_client
    FROM public.profiles
    WHERE lower(email) = lower(COALESCE(d.email, '')) AND user_id IS NOT NULL
    LIMIT 1;
  ELSE
    SELECT organization_id, type_client INTO v_org_id, v_type_client
    FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  END IF;

  v_user_id := COALESCE(v_user_id, _converted_by);
  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id FROM public.user_roles
    WHERE role IN ('admin', 'super_admin') LIMIT 1;
  END IF;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Utilisateur de rattachement introuvable'; END IF;

  v_group := COALESCE(d.mission_group_id, (SELECT mission_group_id FROM public.missions WHERE id = d.mission_id), gen_random_uuid());

  IF v_is_ar THEN
    IF COALESCE(d.prix_aller, 0) > 0 AND COALESCE(d.prix_retour, 0) > 0 THEN
      v_aller := d.prix_aller; v_retour := d.prix_retour;
    ELSE
      SELECT * INTO v_split FROM public.split_ar_prices(COALESCE(d.prix_estime, d.total_ttc, 0));
      v_aller := v_split.aller; v_retour := v_split.retour;
    END IF;
  ELSE
    v_aller := COALESCE(d.prix_estime, d.total_ttc, 0); v_retour := 0;
  END IF;

  SELECT id INTO v_aller_id FROM public.missions
  WHERE devis_id = d.id OR id = d.mission_id
  ORDER BY CASE WHEN COALESCE(leg_type, 'simple') IN ('aller', 'simple') THEN 0 ELSE 1 END, created_at LIMIT 1;

  IF v_aller_id IS NULL THEN
    INSERT INTO public.missions (
      numero, devis_id, user_id, organization_id, fleet_organization_id,
      nom, prenom, email, telephone, ville_depart, ville_arrivee, date_prise_en_charge,
      type_trajet, marque, modele, carburant, vin, immatriculation, remarques, prix_total, statut,
      mission_group_id, leg_type, leg_index, contact_depart_nom, contact_depart_tel,
      contact_depart_note, contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note
    ) VALUES (
      v_target_num, d.id, v_user_id, v_org_id, CASE WHEN v_type_client = 'flotte' THEN v_org_id ELSE NULL END,
      COALESCE(d.nom, ''), COALESCE(d.prenom, ''), COALESCE(d.email, ''), d.telephone,
      d.depart, d.arrivee, COALESCE(d.date_souhaitee, current_date),
      CASE WHEN v_is_ar THEN 'aller_retour' ELSE 'aller_simple' END,
      d.marque, d.modele, d.carburant, v_vin_aller, v_immat_aller, d.message, v_aller, v_status, v_group,
      CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END, 1,
      d.contact_depart_nom, d.contact_depart_tel, d.contact_depart_note,
      d.contact_arrivee_nom, d.contact_arrivee_tel, d.contact_arrivee_note
    ) RETURNING missions.id, missions.numero INTO v_aller_id, v_num;
  ELSE
    UPDATE public.missions AS m SET
      numero = v_target_num, devis_id = d.id,
      organization_id = COALESCE(m.organization_id, v_org_id),
      fleet_organization_id = COALESCE(m.fleet_organization_id, CASE WHEN v_type_client = 'flotte' THEN v_org_id ELSE NULL END),
      mission_group_id = v_group,
      type_trajet = CASE WHEN v_is_ar THEN 'aller_retour' ELSE 'aller_simple' END,
      leg_type = CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END, leg_index = 1,
      marque = COALESCE(m.marque, d.marque), modele = COALESCE(m.modele, d.modele),
      immatriculation = COALESCE(NULLIF(trim(COALESCE(m.immatriculation,'')),''), v_immat_aller),
      vin = COALESCE(NULLIF(trim(COALESCE(m.vin,'')),''), v_vin_aller),
      prix_total = CASE WHEN COALESCE(m.prix_locked, false) THEN m.prix_total ELSE v_aller END,
      updated_at = now()
    WHERE m.id = v_aller_id RETURNING m.numero INTO v_num;
  END IF;

  mission_id := v_aller_id; leg := CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END; numero := v_num; RETURN NEXT;

  IF v_is_ar THEN
    SELECT id INTO v_retour_id FROM public.missions WHERE devis_id = d.id AND leg_type = 'retour' LIMIT 1;
    IF v_retour_id IS NULL THEN
      INSERT INTO public.missions (
        numero, devis_id, user_id, organization_id, fleet_organization_id,
        nom, prenom, email, telephone, ville_depart, ville_arrivee, date_prise_en_charge,
        type_trajet, marque, modele, carburant, vin, immatriculation, remarques, prix_total, statut,
        mission_group_id, leg_type, leg_index, contact_depart_nom, contact_depart_tel,
        contact_depart_note, contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note
      ) VALUES (
        v_target_num, d.id, v_user_id, v_org_id, CASE WHEN v_type_client = 'flotte' THEN v_org_id ELSE NULL END,
        COALESCE(d.nom, ''), COALESCE(d.prenom, ''), COALESCE(d.email, ''), d.telephone,
        CASE WHEN COALESCE(d.recuperation_retour_identique, true) THEN d.arrivee ELSE COALESCE(NULLIF(trim(COALESCE(d.adresse_recuperation_retour, '')), ''), d.depart_retour, d.arrivee) END,
        COALESCE(NULLIF(trim(COALESCE(d.arrivee_retour, '')), ''), d.depart),
        COALESCE(d.date_retour, d.date_souhaitee, current_date), 'aller_retour',
        COALESCE(d.marque_retour, d.marque), COALESCE(d.modele_retour, d.modele), d.carburant,
        v_vin_retour, v_immat_retour, d.message, v_retour, v_status, v_group, 'retour', 2,
        d.contact_arrivee_nom, d.contact_arrivee_tel, d.contact_arrivee_note,
        d.contact_depart_nom, d.contact_depart_tel, d.contact_depart_note
      ) RETURNING missions.id, missions.numero INTO v_retour_id, v_num;
    ELSE
      UPDATE public.missions AS m SET
        numero = v_target_num, devis_id = d.id,
        organization_id = COALESCE(m.organization_id, v_org_id),
        fleet_organization_id = COALESCE(m.fleet_organization_id, CASE WHEN v_type_client = 'flotte' THEN v_org_id ELSE NULL END),
        mission_group_id = v_group, type_trajet = 'aller_retour', leg_type = 'retour', leg_index = 2,
        marque = COALESCE(m.marque, d.marque_retour, d.marque), modele = COALESCE(m.modele, d.modele_retour, d.modele),
        immatriculation = COALESCE(NULLIF(trim(COALESCE(m.immatriculation,'')),''), v_immat_retour),
        vin = COALESCE(NULLIF(trim(COALESCE(m.vin,'')),''), v_vin_retour),
        prix_total = CASE WHEN COALESCE(m.prix_locked, false) THEN m.prix_total ELSE v_retour END,
        updated_at = now()
      WHERE m.id = v_retour_id RETURNING m.numero INTO v_num;
    END IF;
    mission_id := v_retour_id; leg := 'retour'; numero := v_num; RETURN NEXT;
  END IF;

  UPDATE public.trajets SET
    numero_mission = v_target_num,
    is_round_trip = v_is_ar,
    leg_type = CASE WHEN v_is_ar AND COALESCE(leg_index, 1) = 2 THEN 'retour' WHEN v_is_ar THEN 'aller' ELSE 'simple' END,
    immatriculation = COALESCE(
      NULLIF(trim(COALESCE(immatriculation, '')), ''),
      CASE WHEN v_is_ar AND COALESCE(leg_index, 1) = 2 THEN v_immat_retour ELSE v_immat_aller END
    ),
    vin = COALESCE(
      NULLIF(trim(COALESCE(vin, '')), ''),
      CASE WHEN v_is_ar AND COALESCE(leg_index, 1) = 2 THEN v_vin_retour ELSE v_vin_aller END
    ),
    updated_at = now()
  WHERE devis_id = d.id OR mission_group_id = v_group;

  UPDATE public.attributions SET numero_mission = v_target_num, updated_at = now()
  WHERE trajet_id IN (SELECT id FROM public.trajets WHERE devis_id = d.id OR mission_group_id = v_group);

  UPDATE public.devis SET statut = 'convertit', mission_id = v_aller_id, mission_group_id = v_group,
    converted_at = COALESCE(converted_at, now()), converted_by = COALESCE(converted_by, _converted_by), updated_at = now()
  WHERE id = d.id;
  RETURN;
END;
$function$;