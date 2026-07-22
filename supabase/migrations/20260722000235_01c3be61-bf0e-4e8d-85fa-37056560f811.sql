-- Ajoute une référence lisible (GRP-TLG-YYYY-XXX) partagée par toutes les missions/demandes d'un même groupe.
ALTER TABLE public.demandes_convoyage ADD COLUMN IF NOT EXISTS group_reference text;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS group_reference text;

CREATE INDEX IF NOT EXISTS idx_demandes_group_reference ON public.demandes_convoyage(group_reference) WHERE group_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_missions_group_reference ON public.missions(group_reference) WHERE group_reference IS NOT NULL;

-- Séquence annuelle pour générer XXX
CREATE SEQUENCE IF NOT EXISTS public.mission_group_seq;

CREATE OR REPLACE FUNCTION public.generate_group_reference()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  n := nextval('public.mission_group_seq');
  RETURN 'GRP-TLG-' || to_char(now(), 'YYYY') || '-' || lpad((n % 100000)::text, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_group_reference() TO authenticated, service_role;

-- Trigger : quand un devis crée une mission, propage group_reference et mission_group_id
CREATE OR REPLACE FUNCTION public.propagate_group_ref_to_mission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
BEGIN
  IF NEW.mission_group_id IS NULL AND NEW.group_reference IS NULL THEN
    -- Chercher via le devis lié
    SELECT dc.mission_group_id, dc.group_reference INTO d
    FROM public.devis dv
    JOIN public.demandes_convoyage dc ON dc.devis_id = dv.id
    WHERE dv.id = NEW.devis_id
    LIMIT 1;
    IF FOUND THEN
      NEW.mission_group_id := COALESCE(NEW.mission_group_id, d.mission_group_id);
      NEW.group_reference := COALESCE(NEW.group_reference, d.group_reference);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mission_group_ref ON public.missions;
CREATE TRIGGER trg_mission_group_ref
  BEFORE INSERT ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.propagate_group_ref_to_mission();
