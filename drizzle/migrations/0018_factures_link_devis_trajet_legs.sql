ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS devis_id uuid REFERENCES public.devis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trajet_id uuid REFERENCES public.trajets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mission_group_id uuid,
  ADD COLUMN IF NOT EXISTS leg_type text,
  ADD COLUMN IF NOT EXISTS numero_mission text,
  ADD COLUMN IF NOT EXISTS immatriculation text;

CREATE INDEX IF NOT EXISTS idx_factures_devis_id ON public.factures(devis_id);
CREATE INDEX IF NOT EXISTS idx_factures_mission_group_id ON public.factures(mission_group_id);
CREATE INDEX IF NOT EXISTS idx_factures_trajet_id ON public.factures(trajet_id);

-- Backfill : facture -> attribution -> trajet (devis, dossier, jambe, plaque)
UPDATE public.factures f
SET trajet_id = t.id,
    devis_id = COALESCE(f.devis_id, t.devis_id),
    mission_group_id = COALESCE(f.mission_group_id, t.mission_group_id),
    leg_type = COALESCE(f.leg_type, t.leg_type),
    numero_mission = COALESCE(f.numero_mission, t.numero_mission),
    immatriculation = COALESCE(f.immatriculation, t.immatriculation)
FROM public.attributions a
JOIN public.trajets t ON t.id = a.trajet_id
WHERE f.attribution_id = a.id;

-- Backfill : facture -> mission (par numero de dossier + plaque)
UPDATE public.factures f
SET mission_id = m.id
FROM public.missions m
WHERE f.mission_id IS NULL
  AND f.numero_mission IS NOT NULL
  AND m.numero = regexp_replace(f.numero_mission, '(-[LR]|\.[0-9]+)$', '')
  AND (
    f.immatriculation IS NULL
    OR upper(replace(replace(coalesce(m.immatriculation, ''), ' ', ''), '-', ''))
       = upper(replace(replace(f.immatriculation, ' ', ''), '-', ''))
  );

-- Remplissage automatique des liens à l'insertion / mise à jour
CREATE OR REPLACE FUNCTION public.factures_fill_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_rec record;
  m_id uuid;
BEGIN
  IF NEW.attribution_id IS NOT NULL THEN
    SELECT t.* INTO t_rec
    FROM public.attributions a
    JOIN public.trajets t ON t.id = a.trajet_id
    WHERE a.id = NEW.attribution_id;

    IF FOUND THEN
      NEW.trajet_id := COALESCE(NEW.trajet_id, t_rec.id);
      NEW.devis_id := COALESCE(NEW.devis_id, t_rec.devis_id);
      NEW.mission_group_id := COALESCE(NEW.mission_group_id, t_rec.mission_group_id);
      NEW.leg_type := COALESCE(NEW.leg_type, t_rec.leg_type);
      NEW.numero_mission := COALESCE(NEW.numero_mission, t_rec.numero_mission);
      NEW.immatriculation := COALESCE(NEW.immatriculation, t_rec.immatriculation);
    END IF;
  END IF;

  IF NEW.mission_id IS NULL AND NEW.numero_mission IS NOT NULL THEN
    SELECT m.id INTO m_id
    FROM public.missions m
    WHERE m.numero = regexp_replace(NEW.numero_mission, '(-[LR]|\.[0-9]+)$', '')
      AND (
        NEW.immatriculation IS NULL
        OR upper(replace(replace(coalesce(m.immatriculation, ''), ' ', ''), '-', ''))
           = upper(replace(replace(NEW.immatriculation, ' ', ''), '-', ''))
      )
    LIMIT 1;
    NEW.mission_id := m_id;
  END IF;

  IF NEW.devis_id IS NULL AND NEW.mission_id IS NOT NULL THEN
    SELECT m.devis_id INTO NEW.devis_id FROM public.missions m WHERE m.id = NEW.mission_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.factures_fill_links() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_factures_fill_links ON public.factures;
CREATE TRIGGER trg_factures_fill_links
BEFORE INSERT OR UPDATE OF attribution_id, mission_id ON public.factures
FOR EACH ROW EXECUTE FUNCTION public.factures_fill_links();