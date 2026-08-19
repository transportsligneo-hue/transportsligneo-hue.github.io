
ALTER TABLE public.convoyeurs
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS bic text,
  ADD COLUMN IF NOT EXISTS titulaire_compte text;
