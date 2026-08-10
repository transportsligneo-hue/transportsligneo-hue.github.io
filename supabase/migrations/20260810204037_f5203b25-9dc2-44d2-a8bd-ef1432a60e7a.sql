CREATE OR REPLACE FUNCTION public.missions_autocreate_devis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_devis_id uuid;
  v_regime text;
  v_total numeric;
  v_origine text;
BEGIN
  -- Mission déjà rattachée à un devis : rien à faire
  IF NEW.devis_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Un devis existe déjà pour ce groupe (Duo Livraison–Restitution)
  IF NEW.mission_group_id IS NOT NULL THEN
    SELECT id INTO v_devis_id
      FROM public.devis
     WHERE mission_group_id = NEW.mission_group_id
     ORDER BY created_at
     LIMIT 1;
  END IF;

  SELECT COALESCE(regime, 'micro') INTO v_regime FROM public.pricing_settings LIMIT 1;
  v_regime := CASE WHEN v_regime = 'societe' THEN 'societe' ELSE 'micro' END;

  IF v_devis_id IS NOT NULL THEN
    -- Second trajet du duo : on cumule le montant sur le devis existant
    SELECT COALESCE(SUM(prix_total), 0) INTO v_total
      FROM public.missions
     WHERE mission_group_id = NEW.mission_group_id;

    UPDATE public.devis
       SET prix_estime = v_total,
           total_ttc   = v_total,
           total_ht    = CASE WHEN v_regime = 'micro' THEN v_total ELSE round(v_total / 1.2, 2) END,
           total_tva   = CASE WHEN v_regime = 'micro' THEN 0 ELSE round(v_total - (v_total / 1.2), 2) END,
           arrivee_retour = COALESCE(arrivee_retour, NEW.ville_arrivee),
           depart_retour  = COALESCE(depart_retour, NEW.ville_depart),
           date_retour    = COALESCE(date_retour, NEW.date_prise_en_charge),
           option_trajet  = 'aller_retour',
           updated_at     = now()
     WHERE id = v_devis_id;

    UPDATE public.missions SET devis_id = v_devis_id WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  v_total := COALESCE(NEW.prix_total, 0);
  v_origine := CASE
    WHEN public.has_role(NEW.user_id, 'admin'::public.app_role)
      OR public.has_role(NEW.user_id, 'super_admin'::public.app_role) THEN 'manuel'
    ELSE 'demande_client'
  END;

  INSERT INTO public.devis (
    nom, prenom, email, telephone,
    depart, arrivee, date_souhaitee,
    type_vehicule, marque, modele, carburant, vin,
    prix_estime, total_ttc, total_ht, total_tva, regime_snapshot,
    option_trajet, origine, statut, user_id, mission_group_id,
    message
  ) VALUES (
    NEW.nom, NEW.prenom, NEW.email, NEW.telephone,
    NEW.ville_depart, NEW.ville_arrivee, NEW.date_prise_en_charge,
    NEW.marque, NEW.marque, NEW.modele, NEW.carburant, NEW.vin,
    v_total, v_total,
    CASE WHEN v_regime = 'micro' THEN v_total ELSE round(v_total / 1.2, 2) END,
    CASE WHEN v_regime = 'micro' THEN 0 ELSE round(v_total - (v_total / 1.2), 2) END,
    v_regime,
    CASE WHEN NEW.type_trajet IN ('aller_retour', 'aller-retour') THEN 'aller_retour' ELSE 'aller_simple' END,
    v_origine, 'accepte', NEW.user_id, NEW.mission_group_id,
    'Devis généré automatiquement depuis la mission ' || COALESCE(NEW.numero, '')
  )
  RETURNING id INTO v_devis_id;

  -- Forcer le statut (le trigger de protection le remet à « envoye » pour les non-admins)
  UPDATE public.devis
     SET statut = 'accepte',
         accepted_at = COALESCE(accepted_at, now()),
         sent_at = COALESCE(sent_at, now()),
         user_id = NEW.user_id
   WHERE id = v_devis_id;

  UPDATE public.missions SET devis_id = v_devis_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_missions_autocreate_devis ON public.missions;
CREATE TRIGGER trg_missions_autocreate_devis
AFTER INSERT ON public.missions
FOR EACH ROW EXECUTE FUNCTION public.missions_autocreate_devis();