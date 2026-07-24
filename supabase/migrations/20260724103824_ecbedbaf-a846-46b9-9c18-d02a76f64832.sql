ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS devis_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'missions_devis_id_fkey'
      AND conrelid = 'public.missions'::regclass
  ) THEN
    ALTER TABLE public.missions
      ADD CONSTRAINT missions_devis_id_fkey
      FOREIGN KEY (devis_id) REFERENCES public.devis(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.propagate_group_ref_to_mission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  d record;
BEGIN
  IF NEW.devis_id IS NOT NULL AND (NEW.mission_group_id IS NULL OR NEW.group_reference IS NULL) THEN
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