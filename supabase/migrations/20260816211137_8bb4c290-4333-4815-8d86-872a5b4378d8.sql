-- 1. Normalisation d'un numéro : MIS-TLG-YYYY-#NNN (sans suffixe de volet)
CREATE OR REPLACE FUNCTION public.normalize_mission_numero(p_numero text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_numero IS NULL THEN NULL
    ELSE regexp_replace(
           regexp_replace(upper(trim(p_numero)), '[-]?[LRA]$', ''),
           '^(MIS-TLG-[0-9]{4})-#?([0-9]+)$', '\1-#\2'
         )
  END
$$;

-- 2. Numéro canonique d'un dossier (plus petite séquence trouvée)
CREATE OR REPLACE FUNCTION public.canonical_group_numero(p_group_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH nums AS (
    SELECT public.normalize_mission_numero(m.numero) AS n
    FROM public.missions m
    WHERE m.mission_group_id = p_group_id AND m.numero IS NOT NULL
    UNION ALL
    SELECT public.normalize_mission_numero(t.numero_mission)
    FROM public.trajets t
    WHERE t.mission_group_id = p_group_id AND t.numero_mission IS NOT NULL
  )
  SELECT n FROM nums
  WHERE n ~ '^MIS-TLG-[0-9]{4}-#[0-9]+$'
  ORDER BY substring(n from '#([0-9]+)$')::int
  LIMIT 1
$$;

-- 3. Attribution du numéro mission : reprendre le numéro du dossier s'il existe
CREATE OR REPLACE FUNCTION public.missions_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_devis_numero text;
  v_group_numero text;
BEGIN
  IF NEW.mission_group_id IS NOT NULL THEN
    SELECT public.canonical_group_numero(NEW.mission_group_id) INTO v_group_numero;
    IF v_group_numero IS NOT NULL THEN
      NEW.numero := v_group_numero;
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.devis_id IS NOT NULL THEN
    SELECT d.numero INTO v_devis_numero FROM public.devis d WHERE d.id = NEW.devis_id;
  END IF;

  IF v_devis_numero ~ '^DEV-TLG-[0-9]{4}-#?[0-9]{3,}$' THEN
    NEW.numero := public.normalize_mission_numero(regexp_replace(v_devis_numero, '^DEV-', 'MIS-'));
  ELSIF NEW.numero IS NULL OR NEW.numero !~ '^MIS-TLG-[0-9]{4}-#?[0-9]{3,}$' THEN
    NEW.numero := public.normalize_mission_numero(public.next_document_number(
      'MIS-TLG',
      EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int
    ));
  ELSE
    NEW.numero := public.normalize_mission_numero(NEW.numero);
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Idem côté trajets
CREATE OR REPLACE FUNCTION public.trajets_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_devis_numero text;
  v_group_numero text;
BEGIN
  IF NEW.mission_group_id IS NOT NULL THEN
    SELECT public.canonical_group_numero(NEW.mission_group_id) INTO v_group_numero;
    IF v_group_numero IS NOT NULL THEN
      NEW.numero_mission := v_group_numero;
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.devis_id IS NOT NULL THEN
    SELECT d.numero INTO v_devis_numero FROM public.devis d WHERE d.id = NEW.devis_id;
  END IF;

  IF v_devis_numero ~ '^DEV-TLG-[0-9]{4}-#?[0-9]{3,}$' THEN
    NEW.numero_mission := public.normalize_mission_numero(regexp_replace(v_devis_numero, '^DEV-', 'MIS-'));
    RETURN NEW;
  END IF;

  IF NEW.numero_mission ~ '^MIS-TLG-[0-9]{4}-#?[0-9]{3,}$' THEN
    NEW.numero_mission := public.normalize_mission_numero(NEW.numero_mission);
    RETURN NEW;
  END IF;

  NEW.numero_mission := public.normalize_mission_numero(public.next_document_number(
    'MIS-TLG',
    EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int
  ));
  RETURN NEW;
END;
$$;

-- 5. Rattrapage rétroactif : un seul numéro par dossier + format normalisé partout
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
BEGIN
  FOR g IN
    SELECT DISTINCT mission_group_id AS gid
    FROM (
      SELECT mission_group_id FROM public.missions WHERE mission_group_id IS NOT NULL
      UNION
      SELECT mission_group_id FROM public.trajets WHERE mission_group_id IS NOT NULL
    ) s
  LOOP
    v_num := public.canonical_group_numero(g.gid);
    CONTINUE WHEN v_num IS NULL;

    UPDATE public.missions SET numero = v_num
    WHERE mission_group_id = g.gid AND numero IS DISTINCT FROM v_num;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE public.trajets SET numero_mission = v_num
    WHERE mission_group_id = g.gid AND numero_mission IS DISTINCT FROM v_num;
  END LOOP;

  -- Missions / trajets hors dossier : simple normalisation de format
  UPDATE public.missions
  SET numero = public.normalize_mission_numero(numero)
  WHERE numero IS NOT NULL AND numero IS DISTINCT FROM public.normalize_mission_numero(numero);

  UPDATE public.trajets
  SET numero_mission = public.normalize_mission_numero(numero_mission)
  WHERE numero_mission IS NOT NULL
    AND numero_mission IS DISTINCT FROM public.normalize_mission_numero(numero_mission);

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_all_mission_numeros() FROM PUBLIC;

SELECT public.normalize_all_mission_numeros();