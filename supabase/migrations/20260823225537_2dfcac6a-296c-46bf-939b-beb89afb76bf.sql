ALTER TABLE public.demandes_convoyage
  ADD COLUMN IF NOT EXISTS refus_motif text,
  ADD COLUMN IF NOT EXISTS refused_at timestamptz;

ALTER TABLE public.trajets
  ADD COLUMN IF NOT EXISTS refus_motif text,
  ADD COLUMN IF NOT EXISTS refused_at timestamptz;