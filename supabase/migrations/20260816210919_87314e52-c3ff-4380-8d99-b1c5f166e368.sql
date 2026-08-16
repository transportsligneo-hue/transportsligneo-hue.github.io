
CREATE OR REPLACE FUNCTION public.sync_mission_from_trajet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _mission_id uuid;
BEGIN
  SELECT m.id INTO _mission_id
  FROM public.missions m
  WHERE (NEW.mission_id IS NOT NULL AND m.id = NEW.mission_id)
     OR (NEW.numero_mission IS NOT NULL
         AND m.numero = NEW.numero_mission
         AND coalesce(m.leg_type,'simple') = coalesce(NEW.leg_type,'simple'))
  ORDER BY (NEW.mission_id IS NOT NULL AND m.id = NEW.mission_id) DESC
  LIMIT 1;

  IF _mission_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.normalizing_group', '1', true);

  UPDATE public.missions m
     SET statut = public.map_trajet_statut_to_mission(NEW.statut),
         immatriculation = coalesce(nullif(m.immatriculation,''), nullif(NEW.immatriculation,''), nullif(NEW.vehicule_immatriculation,'')),
         vin = coalesce(nullif(m.vin,''), nullif(NEW.vin,''), nullif(NEW.vehicule_vin,'')),
         carburant = coalesce(nullif(m.carburant,''), nullif(NEW.vehicule_energie,'')),
         marque = coalesce(nullif(m.marque,''), nullif(NEW.marque,'')),
         modele = coalesce(nullif(m.modele,''), nullif(NEW.modele,'')),
         updated_at = now()
   WHERE m.id = _mission_id;

  PERFORM set_config('app.normalizing_group', '0', true);
  RETURN NEW;
END;
$$;

-- Restauration des plaques de retour écrasées lors du rattrapage
DO $$
BEGIN
  PERFORM set_config('app.normalizing_group', '1', true);
  UPDATE public.missions SET immatriculation = 'HE201DE' WHERE numero = 'MIS-TLG-2026-085' AND leg_type = 'retour';
  UPDATE public.missions SET immatriculation = 'FR723MT' WHERE numero = 'MIS-TLG-2026-086' AND leg_type = 'retour';
  UPDATE public.missions SET immatriculation = 'GQ053MH' WHERE numero = 'MIS-TLG-2026-087' AND leg_type = 'retour';
  UPDATE public.missions SET immatriculation = 'GQ053MH' WHERE numero = 'MIS-TLG-2026-104' AND leg_type = 'retour';
  PERFORM set_config('app.normalizing_group', '0', true);
END $$;
