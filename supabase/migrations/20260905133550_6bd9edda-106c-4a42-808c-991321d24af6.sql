ALTER TABLE public.mission_signatures
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'pc';
ALTER TABLE public.mission_signatures
  ALTER COLUMN signer_name DROP NOT NULL;