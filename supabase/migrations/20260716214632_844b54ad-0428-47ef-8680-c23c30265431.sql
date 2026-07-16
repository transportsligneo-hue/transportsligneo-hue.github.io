
-- 1. Champ prix_locked sur missions
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS prix_locked boolean NOT NULL DEFAULT false;

-- 2. Split 2/3 - 1/3 avec arrondi centime supérieur sur l'aller
CREATE OR REPLACE FUNCTION public.split_ar_prices(_total numeric)
RETURNS TABLE(aller numeric, retour numeric)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_total numeric := round(COALESCE(_total, 0)::numeric, 2);
  v_aller numeric;
  v_retour numeric;
BEGIN
  IF v_total <= 0 THEN
    aller := 0; retour := 0; RETURN NEXT; RETURN;
  END IF;
  v_aller := ceil(v_total * 200 / 3) / 100;
  IF v_aller > v_total THEN v_aller := v_total; END IF;
  v_retour := round(v_total - v_aller, 2);
  IF v_retour < 0 THEN v_retour := 0; END IF;
  aller := v_aller; retour := v_retour;
  RETURN NEXT;
END;
$$;

-- 3. Conversion demande → missions (1 simple ou 2 aller/retour)
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

  -- Aller (ou mission simple)
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

-- 4. Dissocier le groupe (les 2 missions restent, sans lien)
CREATE OR REPLACE FUNCTION public.admin_unlink_mission_from_group(_mission_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_group uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT mission_group_id INTO v_group FROM public.missions WHERE id = _mission_id;
  IF v_group IS NULL THEN RETURN; END IF;
  UPDATE public.missions
     SET mission_group_id = NULL,
         leg_type = 'simple',
         leg_index = 1,
         type_trajet = 'aller_simple',
         updated_at = now()
   WHERE mission_group_id = v_group;
END;
$$;

-- 5. Annuler un seul sens (l'autre reste actif)
CREATE OR REPLACE FUNCTION public.admin_cancel_mission_leg(_mission_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.missions
     SET statut = 'annulee', updated_at = now()
   WHERE id = _mission_id;
END;
$$;

-- 6. Modifier le prix manuellement (fige la mission)
CREATE OR REPLACE FUNCTION public.admin_set_mission_prix(_mission_id uuid, _prix numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _prix IS NULL OR _prix < 0 OR _prix > 100000 THEN
    RAISE EXCEPTION 'Prix invalide';
  END IF;
  UPDATE public.missions
     SET prix_total = round(_prix::numeric, 2),
         prix_locked = true,
         updated_at = now()
   WHERE id = _mission_id;
END;
$$;

-- 7. GRANTs
GRANT EXECUTE ON FUNCTION public.split_ar_prices(numeric) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_convert_demande_to_missions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_unlink_mission_from_group(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_cancel_mission_leg(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_mission_prix(uuid, numeric) TO authenticated, service_role;
