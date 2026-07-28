CREATE OR REPLACE FUNCTION public.auto_create_trajet_from_devis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_livraison_id uuid;
  v_retour_id uuid;
  v_is_ar boolean;
  v_group uuid;
  v_prix_aller numeric;
  v_prix_retour numeric;
  v_split record;
  v_total numeric;
BEGIN
  IF NOT (
    (NEW.paid_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.paid_at IS NULL))
    OR NEW.statut = 'convertit'
    OR NEW.mission_id IS NOT NULL
  ) THEN
    RETURN NEW;
  END IF;

  v_is_ar := (
    COALESCE(NEW.option_trajet, '') IN ('aller_retour', 'aller-retour')
    OR (NEW.depart_retour IS NOT NULL AND length(trim(NEW.depart_retour)) > 0)
    OR (NEW.arrivee_retour IS NOT NULL AND length(trim(NEW.arrivee_retour)) > 0)
    OR NEW.date_retour IS NOT NULL
  );

  v_group := COALESCE(NEW.mission_group_id, gen_random_uuid());
  v_total := COALESCE(NEW.prix_estime, NEW.total_ttc, 0);

  IF v_is_ar THEN
    IF COALESCE(NEW.prix_aller, 0) > 0 AND COALESCE(NEW.prix_retour, 0) > 0 THEN
      v_prix_aller := NEW.prix_aller;
      v_prix_retour := NEW.prix_retour;
    ELSE
      SELECT * INTO v_split FROM public.split_ar_prices(v_total);
      v_prix_aller := v_split.aller;
      v_prix_retour := v_split.retour;
    END IF;
  ELSE
    v_prix_aller := v_total;
    v_prix_retour := 0;
  END IF;

  SELECT id INTO v_livraison_id
  FROM public.trajets
  WHERE devis_id = NEW.id
    AND COALESCE(leg_type, CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END) = CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END
  ORDER BY COALESCE(leg_index, 1), created_at
  LIMIT 1;

  IF v_livraison_id IS NULL THEN
    INSERT INTO public.trajets (
      devis_id, depart, arrivee, date_trajet, heure_trajet,
      marque, modele, immatriculation,
      client_nom, client_email, client_telephone,
      prix_client, prix, commission_convoyeur_pct,
      statut, statut_publication, pricing_mode, attribution_mode,
      vin, carte_grise_recto_url, carte_grise_verso_url,
      contact_depart_nom, contact_depart_tel, contact_depart_note,
      contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note,
      type_mission, commande_ref,
      mission_group_id, leg_type, leg_index
    ) VALUES (
      NEW.id, NEW.depart, NEW.arrivee, NEW.date_souhaitee, COALESCE(NEW.heure_souhaitee, ''),
      COALESCE(NEW.marque, ''), COALESCE(NEW.modele, ''), '',
      trim(COALESCE(NEW.prenom, '') || ' ' || COALESCE(NEW.nom, '')), NEW.email, COALESCE(NEW.telephone, ''),
      v_prix_aller, v_prix_aller, 65,
      'en_attente', 'publie', 'fixe', 'mixte',
      NEW.vin, NEW.carte_grise_recto_url, NEW.carte_grise_verso_url,
      NEW.contact_depart_nom, NEW.contact_depart_tel, NEW.contact_depart_note,
      NEW.contact_arrivee_nom, NEW.contact_arrivee_tel, NEW.contact_arrivee_note,
      'livraison', NEW.numero,
      v_group, CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END, 1
    ) RETURNING id INTO v_livraison_id;
  ELSE
    UPDATE public.trajets
    SET mission_group_id = COALESCE(mission_group_id, v_group),
        leg_type = CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END,
        leg_index = 1,
        type_mission = COALESCE(type_mission, 'livraison')
    WHERE id = v_livraison_id;
  END IF;

  IF v_is_ar THEN
    SELECT id INTO v_retour_id
    FROM public.trajets
    WHERE devis_id = NEW.id
      AND leg_type = 'retour'
    ORDER BY COALESCE(leg_index, 2), created_at
    LIMIT 1;

    IF v_retour_id IS NULL THEN
      INSERT INTO public.trajets (
        devis_id, depart, arrivee, date_trajet, heure_trajet,
        marque, modele, immatriculation,
        client_nom, client_email, client_telephone,
        prix_client, prix, commission_convoyeur_pct,
        statut, statut_publication, pricing_mode, attribution_mode,
        vin,
        contact_depart_nom, contact_depart_tel, contact_depart_note,
        contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note,
        type_mission, commande_ref, parent_trajet_id,
        mission_group_id, leg_type, leg_index
      ) VALUES (
        NEW.id,
        CASE
          WHEN COALESCE(NEW.recuperation_retour_identique, true) THEN NEW.arrivee
          ELSE COALESCE(NULLIF(trim(COALESCE(NEW.adresse_recuperation_retour, '')), ''), NEW.depart_retour, NEW.arrivee)
        END,
        COALESCE(NULLIF(trim(COALESCE(NEW.arrivee_retour, '')), ''), NEW.depart),
        COALESCE(NEW.date_retour, NEW.date_souhaitee), COALESCE(NEW.heure_retour, ''),
        COALESCE(NEW.marque_retour, NEW.marque, ''), COALESCE(NEW.modele_retour, NEW.modele, ''), COALESCE(NEW.immatriculation_retour, ''),
        trim(COALESCE(NEW.prenom, '') || ' ' || COALESCE(NEW.nom, '')), NEW.email, COALESCE(NEW.telephone, ''),
        v_prix_retour, v_prix_retour, 65,
        'en_attente', 'publie', 'fixe', 'mixte',
        COALESCE(NEW.vin_retour, NEW.vin),
        NEW.contact_arrivee_nom, NEW.contact_arrivee_tel, NEW.contact_arrivee_note,
        NEW.contact_depart_nom, NEW.contact_depart_tel, NEW.contact_depart_note,
        'restitution', NEW.numero, v_livraison_id,
        v_group, 'retour', 2
      );
    ELSE
      UPDATE public.trajets
      SET mission_group_id = COALESCE(mission_group_id, v_group),
          leg_type = 'retour',
          leg_index = 2,
          type_mission = COALESCE(type_mission, 'restitution'),
          parent_trajet_id = COALESCE(parent_trajet_id, v_livraison_id)
      WHERE id = v_retour_id;
    END IF;
  END IF;

  IF NEW.mission_group_id IS NULL THEN
    UPDATE public.devis
    SET mission_group_id = v_group
    WHERE id = NEW.id
      AND mission_group_id IS NULL;
  END IF;

  IF NEW.mission_id IS NOT NULL THEN
    UPDATE public.missions
    SET devis_id = NEW.id,
        mission_group_id = COALESCE(mission_group_id, v_group),
        leg_type = COALESCE(leg_type, CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END),
        leg_index = COALESCE(leg_index, 1)
    WHERE id = NEW.mission_id;
  END IF;

  RETURN NEW;
END;
$function$;

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

  v_is_ar := (
    COALESCE(d.options, '') IN ('aller_retour', 'aller-retour')
    OR COALESCE(d.options, '') ILIKE '%livraison + restitution%'
    OR COALESCE(d.options, '') ILIKE '%aller-retour%'
    OR (d.depart_retour IS NOT NULL AND length(trim(d.depart_retour)) > 0)
    OR (d.arrivee_retour IS NOT NULL AND length(trim(d.arrivee_retour)) > 0)
    OR d.date_retour IS NOT NULL
  );

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

  v_user_id := d.user_id;
  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id
    FROM public.profiles
    WHERE lower(email) = lower(COALESCE(d.email, ''))
      AND user_id IS NOT NULL
    LIMIT 1;
  END IF;

  v_user_id := COALESCE(v_user_id, v_uid);

  IF v_is_ar THEN
    SELECT * INTO v_split FROM public.split_ar_prices(COALESCE(d.prix_estime, 0));
    v_aller := v_split.aller;
    v_retour := v_split.retour;
  ELSE
    v_aller := COALESCE(d.prix_estime, 0);
    v_retour := 0;
  END IF;

  v_group := COALESCE(d.mission_group_id, gen_random_uuid());
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
      options_meta, mission_group_id, leg_type, leg_index, type_mission, parent_trajet_id
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
      COALESCE(d.options_meta, '{}'::jsonb), v_group, 'retour', 2, 'restitution', v_tid
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

DO $$
DECLARE
  d record;
  v_group uuid;
  v_user_id uuid;
  v_aller_mission_id uuid;
  v_retour_mission_id uuid;
  v_livraison_trajet_id uuid;
  v_aller numeric;
  v_retour numeric;
  v_split record;
  v_client_nom text;
BEGIN
  FOR d IN
    SELECT *
    FROM public.devis
    WHERE COALESCE(option_trajet, '') IN ('aller_retour', 'aller-retour')
       OR depart_retour IS NOT NULL
       OR arrivee_retour IS NOT NULL
       OR date_retour IS NOT NULL
  LOOP
    SELECT id INTO v_aller_mission_id
    FROM public.missions
    WHERE devis_id = d.id OR id = d.mission_id
    ORDER BY CASE WHEN COALESCE(leg_type, 'simple') IN ('aller', 'simple') THEN 0 ELSE 1 END, created_at
    LIMIT 1;

    v_group := COALESCE(d.mission_group_id, (SELECT mission_group_id FROM public.missions WHERE id = v_aller_mission_id), gen_random_uuid());
    v_user_id := d.user_id;
    IF v_user_id IS NULL THEN
      SELECT user_id INTO v_user_id FROM public.profiles WHERE lower(email) = lower(COALESCE(d.email, '')) AND user_id IS NOT NULL LIMIT 1;
    END IF;
    IF v_user_id IS NULL THEN
      SELECT user_id INTO v_user_id FROM public.user_roles WHERE role IN ('admin','super_admin') LIMIT 1;
    END IF;
    IF v_user_id IS NULL THEN
      CONTINUE;
    END IF;

    IF COALESCE(d.prix_aller, 0) > 0 AND COALESCE(d.prix_retour, 0) > 0 THEN
      v_aller := d.prix_aller;
      v_retour := d.prix_retour;
    ELSE
      SELECT * INTO v_split FROM public.split_ar_prices(COALESCE(d.prix_estime, d.total_ttc, 0));
      v_aller := v_split.aller;
      v_retour := v_split.retour;
    END IF;

    IF v_aller_mission_id IS NULL THEN
      INSERT INTO public.missions (
        devis_id, user_id, nom, prenom, email, telephone,
        ville_depart, ville_arrivee, date_prise_en_charge,
        type_trajet, marque, modele, carburant, vin, remarques,
        prix_total, statut, mission_group_id, leg_type, leg_index,
        contact_depart_nom, contact_depart_tel, contact_depart_note,
        contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note
      ) VALUES (
        d.id, v_user_id, COALESCE(d.nom, ''), COALESCE(d.prenom, ''), COALESCE(d.email, ''), d.telephone,
        d.depart, d.arrivee, COALESCE(d.date_souhaitee, current_date),
        'aller_retour', d.marque, d.modele, d.carburant, d.vin, d.message,
        v_aller, COALESCE(NULLIF(d.statut, 'convertit'), 'en_attente'), v_group, 'aller', 1,
        d.contact_depart_nom, d.contact_depart_tel, d.contact_depart_note,
        d.contact_arrivee_nom, d.contact_arrivee_tel, d.contact_arrivee_note
      ) RETURNING id INTO v_aller_mission_id;
    ELSE
      UPDATE public.missions
      SET devis_id = d.id,
          mission_group_id = v_group,
          type_trajet = 'aller_retour',
          leg_type = 'aller',
          leg_index = 1,
          prix_total = CASE WHEN COALESCE(prix_locked, false) THEN prix_total ELSE v_aller END
      WHERE id = v_aller_mission_id;
    END IF;

    SELECT id INTO v_retour_mission_id
    FROM public.missions
    WHERE devis_id = d.id AND leg_type = 'retour'
    LIMIT 1;

    IF v_retour_mission_id IS NULL THEN
      INSERT INTO public.missions (
        devis_id, user_id, nom, prenom, email, telephone,
        ville_depart, ville_arrivee, date_prise_en_charge,
        type_trajet, marque, modele, carburant, vin, remarques,
        prix_total, statut, mission_group_id, leg_type, leg_index,
        contact_depart_nom, contact_depart_tel, contact_depart_note,
        contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note
      ) VALUES (
        d.id, v_user_id, COALESCE(d.nom, ''), COALESCE(d.prenom, ''), COALESCE(d.email, ''), d.telephone,
        CASE WHEN COALESCE(d.recuperation_retour_identique, true) THEN d.arrivee ELSE COALESCE(NULLIF(trim(COALESCE(d.adresse_recuperation_retour, '')), ''), d.depart_retour, d.arrivee) END,
        COALESCE(NULLIF(trim(COALESCE(d.arrivee_retour, '')), ''), d.depart),
        COALESCE(d.date_retour, d.date_souhaitee, current_date),
        'aller_retour', COALESCE(d.marque_retour, d.marque), COALESCE(d.modele_retour, d.modele), d.carburant, COALESCE(d.vin_retour, d.vin), d.message,
        v_retour, COALESCE(NULLIF(d.statut, 'convertit'), 'en_attente'), v_group, 'retour', 2,
        d.contact_arrivee_nom, d.contact_arrivee_tel, d.contact_arrivee_note,
        d.contact_depart_nom, d.contact_depart_tel, d.contact_depart_note
      );
    END IF;

    UPDATE public.devis
    SET mission_id = v_aller_mission_id,
        mission_group_id = v_group,
        statut = CASE WHEN statut = 'convertit' THEN statut ELSE statut END
    WHERE id = d.id;
  END LOOP;

  FOR d IN
    SELECT *
    FROM public.demandes_convoyage
    WHERE statut = 'convertie'
      AND (
        COALESCE(options, '') IN ('aller_retour', 'aller-retour')
        OR COALESCE(options, '') ILIKE '%livraison + restitution%'
        OR COALESCE(options, '') ILIKE '%aller-retour%'
        OR depart_retour IS NOT NULL
        OR arrivee_retour IS NOT NULL
        OR date_retour IS NOT NULL
      )
  LOOP
    v_group := COALESCE(d.mission_group_id, gen_random_uuid());
    v_user_id := d.user_id;
    IF v_user_id IS NULL THEN
      SELECT user_id INTO v_user_id FROM public.profiles WHERE lower(email) = lower(COALESCE(d.email, '')) AND user_id IS NOT NULL LIMIT 1;
    END IF;
    IF v_user_id IS NULL THEN
      SELECT user_id INTO v_user_id FROM public.user_roles WHERE role IN ('admin','super_admin') LIMIT 1;
    END IF;
    IF v_user_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_split FROM public.split_ar_prices(COALESCE(d.prix_estime, 0));
    v_aller := v_split.aller;
    v_retour := v_split.retour;
    v_client_nom := trim(COALESCE(d.prenom, '') || ' ' || COALESCE(d.nom, ''));

    SELECT id INTO v_aller_mission_id
    FROM public.missions
    WHERE mission_group_id = v_group AND COALESCE(leg_type, 'simple') IN ('aller', 'simple')
    ORDER BY COALESCE(leg_index, 1), created_at
    LIMIT 1;

    IF v_aller_mission_id IS NULL THEN
      INSERT INTO public.missions (
        user_id, nom, prenom, email, telephone,
        ville_depart, ville_arrivee, date_prise_en_charge,
        type_trajet, marque, modele, immatriculation, carburant, vin, remarques,
        prix_total, statut, mission_group_id, leg_type, leg_index,
        contact_depart_nom, contact_depart_tel, contact_depart_note,
        contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note
      ) VALUES (
        v_user_id, COALESCE(d.nom, ''), COALESCE(d.prenom, ''), COALESCE(d.email, ''), d.telephone,
        d.depart, d.arrivee, COALESCE(d.date_souhaitee, current_date),
        'aller_retour', COALESCE(d.vehicule_marque, d.marque), COALESCE(d.vehicule_modele, d.modele), COALESCE(d.vehicule_immatriculation, d.immatriculation), COALESCE(d.vehicule_energie, d.carburant), d.vehicule_vin, d.message,
        v_aller, 'en_attente', v_group, 'aller', 1,
        d.contact_depart_nom, d.contact_depart_tel, d.contact_depart_note,
        d.contact_arrivee_nom, d.contact_arrivee_tel, d.contact_arrivee_note
      ) RETURNING id INTO v_aller_mission_id;
    ELSE
      UPDATE public.missions
      SET mission_group_id = v_group,
          type_trajet = 'aller_retour',
          leg_type = 'aller',
          leg_index = 1,
          prix_total = CASE WHEN COALESCE(prix_locked, false) THEN prix_total ELSE v_aller END
      WHERE id = v_aller_mission_id;
    END IF;

    SELECT id INTO v_retour_mission_id
    FROM public.missions
    WHERE mission_group_id = v_group AND leg_type = 'retour'
    LIMIT 1;

    IF v_retour_mission_id IS NULL THEN
      INSERT INTO public.missions (
        user_id, nom, prenom, email, telephone,
        ville_depart, ville_arrivee, date_prise_en_charge,
        type_trajet, marque, modele, immatriculation, carburant, vin, remarques,
        prix_total, statut, mission_group_id, leg_type, leg_index,
        contact_depart_nom, contact_depart_tel, contact_depart_note,
        contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note
      ) VALUES (
        v_user_id, COALESCE(d.nom, ''), COALESCE(d.prenom, ''), COALESCE(d.email, ''), d.telephone,
        COALESCE(NULLIF(trim(COALESCE(d.adresse_recuperation_retour, '')), ''), NULLIF(trim(COALESCE(d.depart_retour, '')), ''), d.arrivee),
        COALESCE(NULLIF(trim(COALESCE(d.arrivee_retour, '')), ''), d.depart),
        COALESCE(d.date_retour, d.date_souhaitee, current_date),
        'aller_retour', COALESCE(d.marque_retour, d.vehicule_marque, d.marque), COALESCE(d.modele_retour, d.vehicule_modele, d.modele), COALESCE(d.immatriculation_retour, d.vehicule_immatriculation, d.immatriculation), COALESCE(d.vehicule_energie, d.carburant), COALESCE(d.vin_retour, d.vehicule_vin), d.message,
        v_retour, 'en_attente', v_group, 'retour', 2,
        d.contact_arrivee_nom, d.contact_arrivee_tel, d.contact_arrivee_note,
        d.contact_depart_nom, d.contact_depart_tel, d.contact_depart_note
      );
    END IF;

    SELECT id INTO v_livraison_trajet_id
    FROM public.trajets
    WHERE demande_id = d.id AND COALESCE(leg_type, 'simple') IN ('aller', 'simple')
    ORDER BY COALESCE(leg_index, 1), created_at
    LIMIT 1;

    IF v_livraison_trajet_id IS NULL THEN
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
        COALESCE(d.vehicule_marque, d.marque), COALESCE(d.vehicule_modele, d.modele), COALESCE(d.vehicule_immatriculation, d.immatriculation),
        v_client_nom, d.email, COALESCE(d.telephone, ''),
        v_aller, v_aller, 65,
        'en_attente', 'publie', 'fixe', 'mixte',
        COALESCE(d.vehicule_immatriculation, d.immatriculation), d.vehicule_vin, COALESCE(d.vehicule_energie, d.carburant),
        d.vehicule_type, d.vehicule_couleur, d.vehicule_km, d.vehicule_notes,
        d.contact_depart_nom, d.contact_depart_tel, d.contact_depart_note,
        d.contact_arrivee_nom, d.contact_arrivee_tel, d.contact_arrivee_note,
        COALESCE(d.options_meta, '{}'::jsonb), v_group, 'aller', 1, 'livraison'
      ) RETURNING id INTO v_livraison_trajet_id;
    ELSE
      UPDATE public.trajets
      SET mission_group_id = v_group, leg_type = 'aller', leg_index = 1, type_mission = COALESCE(type_mission, 'livraison')
      WHERE id = v_livraison_trajet_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.trajets WHERE demande_id = d.id AND leg_type = 'retour') THEN
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
        options_meta, mission_group_id, leg_type, leg_index, type_mission, parent_trajet_id
      ) VALUES (
        d.id,
        COALESCE(NULLIF(trim(COALESCE(d.adresse_recuperation_retour, '')), ''), NULLIF(trim(COALESCE(d.depart_retour, '')), ''), d.arrivee),
        COALESCE(NULLIF(trim(COALESCE(d.arrivee_retour, '')), ''), d.depart),
        COALESCE(d.date_retour, d.date_souhaitee), COALESCE(d.heure_retour, ''),
        COALESCE(d.marque_retour, d.vehicule_marque, d.marque), COALESCE(d.modele_retour, d.vehicule_modele, d.modele), COALESCE(d.immatriculation_retour, d.vehicule_immatriculation, d.immatriculation),
        v_client_nom, d.email, COALESCE(d.telephone, ''),
        v_retour, v_retour, 65,
        'en_attente', 'publie', 'fixe', 'mixte',
        COALESCE(d.immatriculation_retour, d.vehicule_immatriculation, d.immatriculation), COALESCE(d.vin_retour, d.vehicule_vin), COALESCE(d.vehicule_energie, d.carburant),
        d.vehicule_type, d.vehicule_couleur, d.vehicule_km, d.vehicule_notes,
        d.contact_arrivee_nom, d.contact_arrivee_tel, d.contact_arrivee_note,
        d.contact_depart_nom, d.contact_depart_tel, d.contact_depart_note,
        COALESCE(d.options_meta, '{}'::jsonb), v_group, 'retour', 2, 'restitution', v_livraison_trajet_id
      );
    END IF;

    UPDATE public.demandes_convoyage
    SET mission_group_id = v_group
    WHERE id = d.id;
  END LOOP;
END $$;