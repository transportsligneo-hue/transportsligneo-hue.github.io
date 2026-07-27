CREATE OR REPLACE FUNCTION public.auto_create_trajet_from_devis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing uuid;
  v_livraison_id uuid;
  v_is_ar boolean;
  v_group uuid;
  v_prix_aller numeric;
  v_prix_retour numeric;
  v_should_create boolean;
BEGIN
  v_should_create :=
    (NEW.paid_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.paid_at IS NULL))
    OR NEW.statut = 'convertit'
    OR NEW.mission_id IS NOT NULL;

  IF NOT v_should_create THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing
  FROM public.trajets
  WHERE devis_id = NEW.id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_is_ar := (
    NEW.depart_retour IS NOT NULL AND length(trim(NEW.depart_retour)) > 0
  ) OR (
    NEW.arrivee_retour IS NOT NULL AND length(trim(NEW.arrivee_retour)) > 0
  ) OR NEW.date_retour IS NOT NULL;

  v_group := COALESCE(NEW.mission_group_id, gen_random_uuid());
  v_prix_aller := COALESCE(NEW.prix_aller, NEW.prix_estime, NEW.total_ttc, 0);
  v_prix_retour := COALESCE(NEW.prix_retour, 0);

  IF v_is_ar AND v_prix_retour = 0 AND COALESCE(NEW.prix_estime, NEW.total_ttc, 0) > v_prix_aller THEN
    v_prix_retour := COALESCE(NEW.prix_estime, NEW.total_ttc, 0) - v_prix_aller;
  END IF;

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
    COALESCE(NEW.marque, ''), COALESCE(NEW.modele, ''), COALESCE(NEW.immatriculation_retour, ''),
    trim(COALESCE(NEW.prenom, '') || ' ' || COALESCE(NEW.nom, '')), NEW.email, COALESCE(NEW.telephone, ''),
    v_prix_aller, v_prix_aller, 65,
    'en_attente', 'publie', 'fixe', 'mixte',
    NEW.vin, NEW.carte_grise_recto_url, NEW.carte_grise_verso_url,
    NEW.contact_depart_nom, NEW.contact_depart_tel, NEW.contact_depart_note,
    NEW.contact_arrivee_nom, NEW.contact_arrivee_tel, NEW.contact_arrivee_note,
    'livraison', NEW.numero,
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
      NEW.vin_retour,
      NEW.contact_arrivee_nom, NEW.contact_arrivee_tel, NEW.contact_arrivee_note,
      NEW.contact_depart_nom, NEW.contact_depart_tel, NEW.contact_depart_note,
      'restitution', NEW.numero, v_livraison_id,
      v_group, 'retour', 2
    );
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

DROP TRIGGER IF EXISTS trg_auto_create_trajet_from_devis ON public.devis;
CREATE TRIGGER trg_auto_create_trajet_from_devis
AFTER INSERT OR UPDATE OF paid_at, statut, mission_id ON public.devis
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_trajet_from_devis();