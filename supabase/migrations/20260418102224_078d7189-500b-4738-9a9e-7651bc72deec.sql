ALTER TABLE public.documents_convoyeurs
  ADD COLUMN IF NOT EXISTS statut_validation text NOT NULL DEFAULT 'en_attente',
  ADD COLUMN IF NOT EXISTS motif_refus text,
  ADD COLUMN IF NOT EXISTS valide_par uuid,
  ADD COLUMN IF NOT EXISTS valide_le timestamp with time zone;

ALTER TABLE public.documents_convoyeurs
  DROP CONSTRAINT IF EXISTS documents_convoyeurs_statut_validation_check;

ALTER TABLE public.documents_convoyeurs
  ADD CONSTRAINT documents_convoyeurs_statut_validation_check
  CHECK (statut_validation IN ('en_attente','approuve','refuse'));