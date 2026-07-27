DO $$
DECLARE
  r record;
  v_is_ar boolean;
  v_group uuid;
  v_prix_aller numeric;
  v_prix_retour numeric;
  v_livraison_id uuid;
BEGIN
  FOR r IN
    SELECT d.*
    FROM public.devis d
    WHERE (d.statut = 'convertit' OR d.mission_id IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM public.trajets t WHERE t.devis_id = d.id
      )
  LOOP
    v_is_ar := (
      r.depart_retour IS NOT NULL AND length(trim(r.depart_retour)) > 0
    ) OR (
      r.arrivee_retour IS NOT NULL AND length(trim(r.arrivee_retour)) > 0
    ) OR r.date_retour IS NOT NULL;

    v_group := COALESCE(r.mission_group_id, gen_random_uuid());
    v_prix_aller := COALESCE(r.prix_aller, r.prix_estime, r.total_ttc, 0);
    v_prix_retour := COALESCE(r.prix_retour, 0);

    IF v_is_ar AND v_prix_retour = 0 AND COALESCE(r.prix_estime, r.total_ttc, 0) > v_prix_aller THEN
      v_prix_retour := COALESCE(r.prix_estime, r.total_ttc, 0) - v_prix_aller;
    END IF;

    UPDATE public.devis
    SET mission_group_id = v_group,
        statut = CASE WHEN statut = 'expire' AND mission_id IS NOT NULL THEN 'convertit' ELSE statut END,
        converted_at = COALESCE(converted_at, now())
    WHERE id = r.id;

    UPDATE public.missions
    SET devis_id = r.id,
        mission_group_id = COALESCE(mission_group_id, v_group),
        leg_type = COALESCE(leg_type, CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END),
        leg_index = COALESCE(leg_index, 1)
    WHERE id = r.mission_id;

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
      r.id, r.depart, r.arrivee, r.date_souhaitee, COALESCE(r.heure_souhaitee, ''),
      COALESCE(r.marque, ''), COALESCE(r.modele, ''), COALESCE(r.immatriculation_retour, ''),
      trim(COALESCE(r.prenom, '') || ' ' || COALESCE(r.nom, '')), r.email, COALESCE(r.telephone, ''),
      v_prix_aller, v_prix_aller, 65,
      'en_attente', 'publie', 'fixe', 'mixte',
      r.vin, r.carte_grise_recto_url, r.carte_grise_verso_url,
      r.contact_depart_nom, r.contact_depart_tel, r.contact_depart_note,
      r.contact_arrivee_nom, r.contact_arrivee_tel, r.contact_arrivee_note,
      'livraison', r.numero,
      v_group, CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END, 1
    ) RETURNING id INTO v_livraison_id;

    IF v_is_ar THEN
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
        r.id,
        CASE
          WHEN COALESCE(r.recuperation_retour_identique, true) THEN r.arrivee
          ELSE COALESCE(NULLIF(trim(COALESCE(r.adresse_recuperation_retour, '')), ''), r.depart_retour, r.arrivee)
        END,
        COALESCE(NULLIF(trim(COALESCE(r.arrivee_retour, '')), ''), r.depart),
        COALESCE(r.date_retour, r.date_souhaitee), COALESCE(r.heure_retour, ''),
        COALESCE(r.marque_retour, r.marque, ''), COALESCE(r.modele_retour, r.modele, ''), COALESCE(r.immatriculation_retour, ''),
        trim(COALESCE(r.prenom, '') || ' ' || COALESCE(r.nom, '')), r.email, COALESCE(r.telephone, ''),
        v_prix_retour, v_prix_retour, 65,
        'en_attente', 'publie', 'fixe', 'mixte',
        r.vin_retour,
        r.contact_arrivee_nom, r.contact_arrivee_tel, r.contact_arrivee_note,
        r.contact_depart_nom, r.contact_depart_tel, r.contact_depart_note,
        'restitution', r.numero, v_livraison_id,
        v_group, 'retour', 2
      );
    END IF;
  END LOOP;
END $$;