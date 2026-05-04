-- B2: Dédoublonnage signatures + lien devis → mission

-- 1. Contrainte unique sur mission_signatures (attribution + kind)
-- Empêche les doublons côté DB même si le client tente d'insérer 2 fois
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mission_signatures_attribution_kind_uniq'
  ) THEN
    -- Nettoyer les éventuels doublons (garder le plus récent)
    DELETE FROM public.mission_signatures a
    USING public.mission_signatures b
    WHERE a.attribution_id = b.attribution_id
      AND a.kind = b.kind
      AND a.created_at < b.created_at;

    ALTER TABLE public.mission_signatures
      ADD CONSTRAINT mission_signatures_attribution_kind_uniq
      UNIQUE (attribution_id, kind);
  END IF;
END $$;

-- 2. Ajouter le lien devis → mission convertie
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS mission_id uuid,
  ADD COLUMN IF NOT EXISTS converted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS converted_by uuid;

CREATE INDEX IF NOT EXISTS idx_devis_mission_id ON public.devis(mission_id);