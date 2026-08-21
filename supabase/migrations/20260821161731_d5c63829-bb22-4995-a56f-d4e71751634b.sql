-- 1. La synchronisation trajet/mission déclenchée par l'avancement d'une attribution
--    doit être identifiée comme une synchronisation interne.
CREATE OR REPLACE FUNCTION public.sync_trajet_from_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trajet_statut text;
  v_mission_statut text;
  v_mission_id uuid;
  v_prev text;
BEGIN
  IF NEW.trajet_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_trajet_statut := CASE
    WHEN NEW.statut IN ('termine','validee','en_attente_validation') THEN 'termine'
    WHEN NEW.statut = 'annule' THEN NULL
    WHEN NEW.statut IN ('en_cours','demarree')
      OR COALESCE(NEW.etape_courante,'') IN ('en_route','sur_place','edl_depart','en_transit','arrive_destination','edl_arrivee','en_attente_validation')
      THEN 'en_cours'
    ELSE 'attribue'
  END;

  IF v_trajet_statut IS NULL THEN
    RETURN NEW;
  END IF;

  v_prev := coalesce(current_setting('app.normalizing_group', true), '0');
  PERFORM set_config('app.normalizing_group', '1', true);

  UPDATE public.trajets t
     SET statut = v_trajet_statut,
         statut_publication = CASE WHEN t.statut_publication = 'publie' THEN 'attribue' ELSE t.statut_publication END,
         updated_at = now()
   WHERE t.id = NEW.trajet_id
     AND t.statut IS DISTINCT FROM v_trajet_statut
     AND t.statut <> 'annule'
   RETURNING t.mission_id INTO v_mission_id;

  IF v_mission_id IS NOT NULL THEN
    v_mission_statut := CASE v_trajet_statut
      WHEN 'termine' THEN 'livree'
      WHEN 'en_cours' THEN 'en_cours'
      ELSE 'confirmee'
    END;
    UPDATE public.missions m
       SET statut = v_mission_statut, updated_at = now()
     WHERE m.id = v_mission_id
       AND m.statut IS DISTINCT FROM v_mission_statut
       AND m.statut <> 'annulee';
  END IF;

  PERFORM set_config('app.normalizing_group', v_prev, true);
  RETURN NEW;
END;
$$;

-- 2. Les protections de la table missions laissent passer les synchronisations internes.
CREATE OR REPLACE FUNCTION public.missions_protect_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Synchronisation interne (triggers système)
  IF coalesce(current_setting('app.normalizing_group', true), '0') = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.prix_total IS DISTINCT FROM OLD.prix_total THEN
    RAISE EXCEPTION 'Modification du prix non autorisée';
  END IF;

  IF NEW.statut IS DISTINCT FROM OLD.statut THEN
    RAISE EXCEPTION 'Modification du statut non autorisée';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Modification de l''organisation non autorisée';
  END IF;

  IF NEW.fleet_organization_id IS DISTINCT FROM OLD.fleet_organization_id THEN
    RAISE EXCEPTION 'Modification de la flotte non autorisée';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Modification du propriétaire non autorisée';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.missions_lock_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- service_role / jobs internes
  END IF;
  IF coalesce(current_setting('app.normalizing_group', true), '0') = '1' THEN
    RETURN NEW; -- synchronisation interne (triggers système)
  END IF;

  NEW.id := OLD.id;
  NEW.numero := OLD.numero;
  NEW.user_id := OLD.user_id;
  NEW.email := OLD.email;
  NEW.prix_total := OLD.prix_total;
  NEW.statut := OLD.statut;
  NEW.organization_id := OLD.organization_id;
  NEW.fleet_organization_id := OLD.fleet_organization_id;
  NEW.immatriculation := OLD.immatriculation;
  NEW.vin := OLD.vin;
  NEW.marque := OLD.marque;
  NEW.modele := OLD.modele;
  NEW.carburant := OLD.carburant;
  NEW.mission_group_id := OLD.mission_group_id;
  NEW.leg_type := OLD.leg_type;
  NEW.leg_index := OLD.leg_index;
  NEW.group_reference := OLD.group_reference;
  NEW.prix_locked := OLD.prix_locked;
  NEW.devis_id := OLD.devis_id;
  NEW.tracking_code := OLD.tracking_code;
  NEW.created_at := OLD.created_at;
  NEW.archived_at := OLD.archived_at;
  RETURN NEW;
END;
$$;