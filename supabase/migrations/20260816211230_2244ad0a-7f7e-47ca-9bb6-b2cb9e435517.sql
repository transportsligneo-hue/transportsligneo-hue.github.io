CREATE OR REPLACE FUNCTION public.canonical_group_numero(p_group_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH nums AS (
    SELECT public.normalize_mission_numero(m.numero) AS n, 0 AS pri
    FROM public.missions m
    WHERE m.mission_group_id = p_group_id AND m.numero IS NOT NULL
    UNION ALL
    SELECT public.normalize_mission_numero(t.numero_mission), 1
    FROM public.trajets t
    WHERE t.mission_group_id = p_group_id AND t.numero_mission IS NOT NULL
  )
  SELECT n FROM nums
  WHERE n ~ '^MIS-TLG-[0-9]{4}-#[0-9]+$'
  ORDER BY pri, substring(n from '#([0-9]+)$')::int
  LIMIT 1
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
  PERFORM set_config('app.normalizing_group', '1', true);

  FOR g IN
    SELECT DISTINCT gid FROM (
      SELECT mission_group_id AS gid FROM public.missions WHERE mission_group_id IS NOT NULL
      UNION
      SELECT mission_group_id FROM public.trajets WHERE mission_group_id IS NOT NULL
    ) s
  LOOP
    v_num := public.canonical_group_numero(g.gid);
    CONTINUE WHEN v_num IS NULL;

    UPDATE public.missions SET numero = v_num
    WHERE mission_group_id = g.gid AND numero IS DISTINCT FROM v_num;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_count := v_count + v_n;

    UPDATE public.trajets SET numero_mission = v_num
    WHERE mission_group_id = g.gid AND numero_mission IS DISTINCT FROM v_num;
  END LOOP;

  UPDATE public.missions
  SET numero = public.normalize_mission_numero(numero)
  WHERE numero IS NOT NULL AND numero IS DISTINCT FROM public.normalize_mission_numero(numero);

  UPDATE public.trajets
  SET numero_mission = public.normalize_mission_numero(numero_mission)
  WHERE numero_mission IS NOT NULL
    AND numero_mission IS DISTINCT FROM public.normalize_mission_numero(numero_mission);

  PERFORM set_config('app.normalizing_group', '0', true);
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_all_mission_numeros() FROM PUBLIC;

SELECT public.normalize_all_mission_numeros();