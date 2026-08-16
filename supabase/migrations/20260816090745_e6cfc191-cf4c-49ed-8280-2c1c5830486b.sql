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
    public.devis_is_aller_retour(NEW.option_trajet)
    OR (NEW.depart_retour IS NOT NULL AND length(trim(NEW.depart_retour)) > 0)
    OR (NEW.arrivee_retour IS NOT NULL AND length(trim(NEW.arrivee_retour)) > 0)
    OR NEW.date_retour IS NOT NULL
    OR (NEW.immatriculation_retour IS NOT NULL AND length(trim(NEW.immatriculation_retour)) > 0)
    OR (NEW.vin_retour IS NOT NULL AND length(trim(NEW.vin_retour)) > 0)
    OR COALESCE(NEW.prix_retour, 0) > 0
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
      COALESCE(NEW.marque, ''), COALESCE(NEW.modele, ''), COALESCE(NEW.immatriculation, ''),
      trim(COALESCE(NEW.prenom, '') || ' ' || COALESCE(NEW.nom, '')), NEW.email, COALESCE(NEW.telephone, ''),
      v_prix_aller, v_prix_aller, 65,
      'en_attente', 'publie', 'fixe', 'mixte',
      NEW.vin, NEW.carte_grise_recto_url, NEW.carte_grise_verso_url,
      NEW.contact_depart_nom, NEW.contact_depart_tel, NEW.contact_depart_note,
      NEW.contact_arrivee_nom, NEW.contact_arrivee_tel, NEW.contact_arrivee_note,
      CASE WHEN v_is_ar THEN 'aller_retour' ELSE 'livraison' END, NEW.numero,
      v_group, CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END, 1
    ) RETURNING id INTO v_livraison_id;
  ELSE
    UPDATE public.trajets
    SET mission_group_id = COALESCE(mission_group_id, v_group),
        leg_type = CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END,
        leg_index = 1,
        immatriculation = CASE WHEN COALESCE(NULLIF(trim(immatriculation), ''), '') = '' THEN COALESCE(NEW.immatriculation, immatriculation) ELSE immatriculation END,
        vin = COALESCE(vin, NEW.vin),
        type_mission = CASE WHEN v_is_ar THEN 'aller_retour' ELSE COALESCE(type_mission, 'livraison') END
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
        'aller_retour', NEW.numero, v_livraison_id,
        v_group, 'retour', 2
      );
    ELSE
      UPDATE public.trajets
      SET mission_group_id = COALESCE(mission_group_id, v_group),
          leg_type = 'retour',
          leg_index = 2,
          immatriculation = CASE WHEN COALESCE(NULLIF(trim(immatriculation), ''), '') = '' THEN COALESCE(NEW.immatriculation_retour, immatriculation) ELSE immatriculation END,
          vin = COALESCE(vin, NEW.vin_retour, NEW.vin),
          type_mission = 'aller_retour',
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