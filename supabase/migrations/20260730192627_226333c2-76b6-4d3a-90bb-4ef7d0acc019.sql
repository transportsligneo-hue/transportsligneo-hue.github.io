ALTER TABLE public.trajets
ADD COLUMN IF NOT EXISTS mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trajets_mission_id ON public.trajets(mission_id);

UPDATE public.trajets t
SET mission_id = m.id
FROM public.missions m
WHERE t.mission_id IS NULL
  AND t.devis_id IS NOT NULL
  AND m.devis_id = t.devis_id
  AND (
    t.leg_type IS NULL
    OR m.leg_type IS NULL
    OR t.leg_type = m.leg_type
  );