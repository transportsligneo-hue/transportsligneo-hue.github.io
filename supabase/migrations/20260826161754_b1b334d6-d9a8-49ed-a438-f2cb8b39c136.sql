-- Suffixe de volet à partir du trajet
CREATE OR REPLACE FUNCTION public.mission_leg_suffix(_trajet_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN t.id IS NULL THEN ''
    WHEN (SELECT count(*) FROM public.trajets s
           WHERE t.mission_group_id IS NOT NULL AND s.mission_group_id = t.mission_group_id) > 1
      THEN CASE WHEN t.leg_type = 'retour' OR t.leg_index = 2 THEN '-R' ELSE '-L' END
    ELSE ''
  END
  FROM public.trajets t WHERE t.id = _trajet_id
$$;

-- Base d'un numéro (sans suffixe de volet), normalisée avec #
CREATE OR REPLACE FUNCTION public.mission_numero_base(_numero text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _numero IS NULL OR btrim(_numero) = '' THEN NULL
    ELSE btrim(regexp_replace(btrim(_numero), '\s*[-–]?\s*(L|R|A)$', '', 'i'))
  END
$$;

-- Le numéro du trajet est la source de vérité : on propage sur les attributions
CREATE OR REPLACE FUNCTION public.sync_attribution_numero_from_trajet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text := public.mission_numero_base(NEW.numero_mission);
BEGIN
  IF v_base IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.numero_mission IS NOT DISTINCT FROM OLD.numero_mission THEN
    RETURN NEW;
  END IF;

  UPDATE public.attributions a
     SET numero_mission = v_base || public.mission_leg_suffix(NEW.id),
         updated_at = now()
   WHERE a.trajet_id = NEW.id
     AND a.numero_mission IS DISTINCT FROM v_base || public.mission_leg_suffix(NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_attribution_numero ON public.trajets;
CREATE TRIGGER trg_sync_attribution_numero
AFTER INSERT OR UPDATE OF numero_mission ON public.trajets
FOR EACH ROW EXECUTE FUNCTION public.sync_attribution_numero_from_trajet();

-- Une nouvelle attribution hérite du numéro du trajet
CREATE OR REPLACE FUNCTION public.attribution_inherit_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text;
BEGIN
  IF NEW.trajet_id IS NULL THEN RETURN NEW; END IF;
  SELECT public.mission_numero_base(t.numero_mission) INTO v_base
    FROM public.trajets t WHERE t.id = NEW.trajet_id;
  IF v_base IS NOT NULL THEN
    NEW.numero_mission := v_base || public.mission_leg_suffix(NEW.trajet_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attribution_inherit_numero ON public.attributions;
CREATE TRIGGER trg_attribution_inherit_numero
BEFORE INSERT ON public.attributions
FOR EACH ROW EXECUTE FUNCTION public.attribution_inherit_numero();

-- Réparation des données existantes désynchronisées
UPDATE public.attributions a
   SET numero_mission = public.mission_numero_base(t.numero_mission) || public.mission_leg_suffix(t.id),
       updated_at = now()
  FROM public.trajets t
 WHERE a.trajet_id = t.id
   AND t.numero_mission IS NOT NULL
   AND a.numero_mission IS DISTINCT FROM public.mission_numero_base(t.numero_mission) || public.mission_leg_suffix(t.id);

-- Table missions (miroir) alignée sur le numéro de base du trajet
UPDATE public.missions m
   SET numero = public.mission_numero_base(t.numero_mission),
       updated_at = now()
  FROM public.trajets t
 WHERE t.numero_mission IS NOT NULL
   AND m.mission_group_id IS NOT NULL
   AND m.mission_group_id = t.mission_group_id
   AND m.numero IS DISTINCT FROM public.mission_numero_base(t.numero_mission);