-- La synchro trajet→mission remettait le drapeau interne à '0' : on restaure la valeur précédente
CREATE OR REPLACE FUNCTION public.sync_mission_from_trajet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mission_id uuid;
  _prev text;
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

  _prev := coalesce(current_setting('app.normalizing_group', true), '0');
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

  PERFORM set_config('app.normalizing_group', _prev, true);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_all_mission_numeros()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g record;
  v_num text;
  v_count int := 0;
  v_n int;
BEGIN
  FOR g IN
    SELECT DISTINCT gid FROM (
      SELECT mission_group_id AS gid FROM public.missions WHERE mission_group_id IS NOT NULL
      UNION
      SELECT mission_group_id FROM public.trajets WHERE mission_group_id IS NOT NULL
    ) s
  LOOP
    v_num := public.canonical_group_numero(g.gid);
    CONTINUE WHEN v_num IS NULL;

    PERFORM set_config('app.normalizing_group', '1', true);
    UPDATE public.missions SET numero = v_num
    WHERE mission_group_id = g.gid AND numero IS DISTINCT FROM v_num;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_count := v_count + v_n;

    UPDATE public.trajets SET numero_mission = v_num
    WHERE mission_group_id = g.gid AND numero_mission IS DISTINCT FROM v_num;
  END LOOP;

  PERFORM set_config('app.normalizing_group', '1', true);
  UPDATE public.missions
  SET numero = public.normalize_mission_numero(numero)
  WHERE numero IS NOT NULL AND numero IS DISTINCT FROM public.normalize_mission_numero(numero);

  UPDATE public.trajets
  SET numero_mission = public.normalize_mission_numero(numero_mission)
  WHERE numero_mission IS NOT NULL
    AND numero_mission IS DISTINCT FROM public.normalize_mission_numero(numero_mission);

  PERFORM set_config('app.normalizing_group', '1', true);
  UPDATE public.missions
  SET numero = public.normalize_mission_numero(numero)
  WHERE numero IS NOT NULL AND numero IS DISTINCT FROM public.normalize_mission_numero(numero);

  PERFORM set_config('app.normalizing_group', '0', true);
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_all_mission_numeros() FROM PUBLIC;

SELECT public.normalize_all_mission_numeros();