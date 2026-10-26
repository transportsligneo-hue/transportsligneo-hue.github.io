-- Câblage énergie / type / VIN : le véhicule d'une mission doit toujours porter
-- les infos saisies à la demande (plaque → SIV → énergie, type, VIN), quelle que soit
-- la voie de création (demande, devis converti, import B2B…).
-- 1) Trigger : à l'écriture d'un trajet, on complète les champs vides depuis la mission liée puis le devis.
-- 2) Trigger inverse : une mission qui reçoit une énergie / un VIN la transmet à son trajet.
-- 3) Rattrapage des missions existantes (dont les terminées).

CREATE OR REPLACE FUNCTION public.trajet_fill_vehicule_meta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_m_carb text; v_m_vin text;
  v_d_carb text; v_d_type text; v_d_vin text;
  v_energie text; v_type text; v_vin text;
BEGIN
  v_energie := nullif(trim(coalesce(NEW.vehicule_energie, '')), '');
  v_type    := nullif(trim(coalesce(NEW.vehicule_type, '')), '');
  v_vin     := coalesce(nullif(trim(coalesce(NEW.vin, '')), ''), nullif(trim(coalesce(NEW.vehicule_vin, '')), ''));

  IF v_energie IS NOT NULL AND v_type IS NOT NULL AND v_vin IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT mi.carburant, mi.vin INTO v_m_carb, v_m_vin
    FROM public.missions mi
   WHERE (NEW.mission_id IS NOT NULL AND mi.id = NEW.mission_id)
      OR (NEW.numero_mission IS NOT NULL AND mi.numero = NEW.numero_mission
          AND coalesce(mi.leg_type, 'simple') = coalesce(NEW.leg_type, 'simple'))
   ORDER BY (NEW.mission_id IS NOT NULL AND mi.id = NEW.mission_id) DESC
   LIMIT 1;

  IF NEW.devis_id IS NOT NULL THEN
    SELECT dv.carburant, dv.type_vehicule,
           CASE WHEN coalesce(NEW.leg_type, 'simple') = 'retour'
                THEN coalesce(nullif(dv.vin_retour, ''), dv.vin) ELSE dv.vin END
      INTO v_d_carb, v_d_type, v_d_vin
      FROM public.devis dv WHERE dv.id = NEW.devis_id;
  END IF;

  v_energie := coalesce(v_energie, nullif(trim(coalesce(v_m_carb, '')), ''), nullif(trim(coalesce(v_d_carb, '')), ''));
  v_type    := coalesce(v_type, nullif(trim(coalesce(v_d_type, '')), ''));
  v_vin     := coalesce(v_vin, nullif(trim(coalesce(v_m_vin, '')), ''), nullif(trim(coalesce(v_d_vin, '')), ''));

  -- Dernier recours : modèles 100 % électriques évidents
  IF v_energie IS NULL AND (coalesce(NEW.marque, '') || ' ' || coalesce(NEW.modele, '')) ~*
     '(tesla|\yzoe\y|renault\s+5\y|r5\s*e-?tech|megane\s*e-?tech|scenic\s*e-?tech|\yid\.?\s?[3457]\y|e-?tron|ioniq\s?[56]|\yleaf\y|ariya|\yeq[abcesv]\y)' THEN
    v_energie := 'electrique';
  END IF;

  NEW.vehicule_energie := v_energie;
  NEW.vehicule_type    := v_type;
  IF v_vin IS NOT NULL THEN
    NEW.vin := coalesce(nullif(NEW.vin, ''), v_vin);
    NEW.vehicule_vin := coalesce(nullif(NEW.vehicule_vin, ''), v_vin);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trajet_fill_vehicule_meta ON public.trajets;
CREATE TRIGGER trg_trajet_fill_vehicule_meta
  BEFORE INSERT OR UPDATE ON public.trajets
  FOR EACH ROW EXECUTE FUNCTION public.trajet_fill_vehicule_meta();

CREATE OR REPLACE FUNCTION public.mission_push_vehicule_meta_to_trajet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF pg_trigger_depth() > 2 OR coalesce(current_setting('app.normalizing_group', true), '0') = '1' THEN
    RETURN NEW;
  END IF;
  IF coalesce(NEW.carburant, '') = '' AND coalesce(NEW.vin, '') = '' THEN
    RETURN NEW;
  END IF;
  UPDATE public.trajets t
     SET vehicule_energie = coalesce(nullif(t.vehicule_energie, ''), nullif(NEW.carburant, '')),
         vin = coalesce(nullif(t.vin, ''), nullif(t.vehicule_vin, ''), nullif(NEW.vin, '')),
         vehicule_vin = coalesce(nullif(t.vehicule_vin, ''), nullif(t.vin, ''), nullif(NEW.vin, ''))
   WHERE (t.mission_id = NEW.id
      OR (t.numero_mission IS NOT NULL AND t.numero_mission = NEW.numero
          AND coalesce(t.leg_type, 'simple') = coalesce(NEW.leg_type, 'simple')))
     AND (coalesce(t.vehicule_energie, '') = '' OR (coalesce(t.vin, '') = '' AND coalesce(t.vehicule_vin, '') = ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mission_push_vehicule_meta ON public.missions;
CREATE TRIGGER trg_mission_push_vehicule_meta
  AFTER INSERT OR UPDATE OF carburant, vin ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.mission_push_vehicule_meta_to_trajet();

-- Rattrapage : un « no-op » sur les trajets sans énergie / type / VIN déclenche le trigger de remplissage.
DO $$
BEGIN
  PERFORM set_config('app.normalizing_group', '1', true);
  UPDATE public.trajets
     SET vehicule_energie = vehicule_energie
   WHERE coalesce(vehicule_energie, '') = ''
      OR coalesce(vehicule_type, '') = ''
      OR (coalesce(vin, '') = '' AND coalesce(vehicule_vin, '') = '');
  PERFORM set_config('app.normalizing_group', '0', true);
END $$;
