
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_trajet_from_attribution ON public.attributions;
CREATE TRIGGER trg_sync_trajet_from_attribution
AFTER INSERT OR UPDATE OF statut, etape_courante ON public.attributions
FOR EACH ROW EXECUTE FUNCTION public.sync_trajet_from_attribution();

-- Backfill : réaligner les trajets/missions existants
WITH best AS (
  SELECT DISTINCT ON (a.trajet_id) a.trajet_id, a.statut, a.etape_courante
  FROM public.attributions a
  WHERE a.trajet_id IS NOT NULL AND a.statut <> 'annule'
  ORDER BY a.trajet_id,
    CASE a.statut WHEN 'validee' THEN 5 WHEN 'termine' THEN 4 WHEN 'en_attente_validation' THEN 3 WHEN 'en_cours' THEN 2 ELSE 1 END DESC,
    a.updated_at DESC
), mapped AS (
  SELECT trajet_id,
    CASE
      WHEN statut IN ('termine','validee','en_attente_validation') THEN 'termine'
      WHEN statut IN ('en_cours','demarree')
        OR COALESCE(etape_courante,'') IN ('en_route','sur_place','edl_depart','en_transit','arrive_destination','edl_arrivee','en_attente_validation')
        THEN 'en_cours'
      ELSE 'attribue'
    END AS cible
  FROM best
)
UPDATE public.trajets t
   SET statut = m.cible, updated_at = now()
  FROM mapped m
 WHERE t.id = m.trajet_id
   AND t.statut <> 'annule'
   AND t.statut IS DISTINCT FROM m.cible;

UPDATE public.missions m
   SET statut = CASE t.statut WHEN 'termine' THEN 'livree' WHEN 'en_cours' THEN 'en_cours' ELSE 'confirmee' END,
       updated_at = now()
  FROM public.trajets t
 WHERE t.mission_id = m.id
   AND m.statut <> 'annulee'
   AND t.statut IN ('termine','en_cours','attribue')
   AND m.statut IS DISTINCT FROM CASE t.statut WHEN 'termine' THEN 'livree' WHEN 'en_cours' THEN 'en_cours' ELSE 'confirmee' END;
