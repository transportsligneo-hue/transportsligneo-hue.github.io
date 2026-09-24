CREATE OR REPLACE FUNCTION public.attributions_sync_duo_twin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _grp uuid;
  _tw record;
  _base text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  SELECT mission_group_id INTO _grp FROM trajets WHERE id = NEW.trajet_id;
  IF _grp IS NULL THEN RETURN NEW; END IF;
  _base := regexp_replace(coalesce(NEW.numero_mission,''), '[ALR]$', '');
  FOR _tw IN
    SELECT t.id, t.leg_type FROM trajets t
    WHERE t.mission_group_id = _grp AND t.id <> NEW.trajet_id
      AND coalesce(t.statut,'') <> 'annule'
      AND NOT EXISTS (SELECT 1 FROM attributions a WHERE a.trajet_id = t.id AND a.statut <> 'annule')
  LOOP
    INSERT INTO attributions (trajet_id, convoyeur_id, statut, mode, statut_convoyeur, numero_mission)
    VALUES (_tw.id, NEW.convoyeur_id, NEW.statut, NEW.mode, NEW.statut_convoyeur,
      CASE WHEN _base = '' THEN NULL ELSE _base || CASE WHEN _tw.leg_type = 'retour' THEN 'R' ELSE 'A' END END);
    UPDATE trajets SET statut = 'attribue', statut_publication = 'attribue' WHERE id = _tw.id;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_attributions_sync_duo_twin ON public.attributions;
CREATE TRIGGER trg_attributions_sync_duo_twin AFTER INSERT ON public.attributions
FOR EACH ROW EXECUTE FUNCTION public.attributions_sync_duo_twin();

-- Backfill : jambes jumelles non attribuées d'un duo déjà attribué
INSERT INTO attributions (trajet_id, convoyeur_id, statut, mode, statut_convoyeur, numero_mission)
SELECT t.id, a.convoyeur_id, a.statut, a.mode, a.statut_convoyeur,
  regexp_replace(coalesce(a.numero_mission,''), '[ALR]$', '') || CASE WHEN t.leg_type='retour' THEN 'R' ELSE 'A' END
FROM trajets t
JOIN trajets s ON s.mission_group_id = t.mission_group_id AND s.id <> t.id
JOIN LATERAL (SELECT * FROM attributions x WHERE x.trajet_id = s.id AND x.statut <> 'annule' ORDER BY created_at DESC LIMIT 1) a ON true
WHERE t.mission_group_id IS NOT NULL AND coalesce(t.statut,'') NOT IN ('annule','termine')
  AND NOT EXISTS (SELECT 1 FROM attributions y WHERE y.trajet_id = t.id);

UPDATE trajets t SET statut='attribue', statut_publication='attribue'
WHERE t.mission_group_id IS NOT NULL AND t.statut='en_attente'
  AND EXISTS (SELECT 1 FROM attributions a WHERE a.trajet_id=t.id AND a.statut <> 'annule');