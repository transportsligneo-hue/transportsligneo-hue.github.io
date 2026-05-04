-- B1 : Mode de tarification des trajets (prix fixe / enchère + marge indicative)
ALTER TABLE public.trajets
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'fixe',
  ADD COLUMN IF NOT EXISTS prix_client_ttc numeric,
  ADD COLUMN IF NOT EXISTS prix_convoyeur_fixe numeric,
  ADD COLUMN IF NOT EXISTS prix_convoyeur_min numeric,
  ADD COLUMN IF NOT EXISTS prix_convoyeur_max numeric,
  ADD COLUMN IF NOT EXISTS marge_indicative_pct numeric DEFAULT 35;

-- Validation souple : pricing_mode doit être 'fixe' ou 'enchere'
ALTER TABLE public.trajets
  DROP CONSTRAINT IF EXISTS trajets_pricing_mode_check;
ALTER TABLE public.trajets
  ADD CONSTRAINT trajets_pricing_mode_check
  CHECK (pricing_mode IN ('fixe', 'enchere'));

COMMENT ON COLUMN public.trajets.pricing_mode IS 'fixe = prix convoyeur imposé (accept/refuse), enchere = driver propose son prix';
COMMENT ON COLUMN public.trajets.marge_indicative_pct IS 'Marge cible indicative (jamais imposée). Sert uniquement à colorer la marge réelle dans l''UI admin.';