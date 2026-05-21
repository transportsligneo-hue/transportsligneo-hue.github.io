ALTER TABLE public.attributions
  ADD COLUMN IF NOT EXISTS pdf_share_client boolean NOT NULL DEFAULT false;