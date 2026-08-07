ALTER TABLE public.convoyeur_contrats
  ALTER COLUMN token_hash DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'interne',
  ADD COLUMN IF NOT EXISTS yousign_environment text,
  ADD COLUMN IF NOT EXISTS yousign_signature_request_id text,
  ADD COLUMN IF NOT EXISTS yousign_document_id text,
  ADD COLUMN IF NOT EXISTS yousign_signer_id text,
  ADD COLUMN IF NOT EXISTS signature_link text,
  ADD COLUMN IF NOT EXISTS signed_pdf_path text,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason text;

ALTER TABLE public.convoyeur_contrats DROP CONSTRAINT IF EXISTS convoyeur_contrats_statut_check;
ALTER TABLE public.convoyeur_contrats ADD CONSTRAINT convoyeur_contrats_statut_check
  CHECK (statut = ANY (ARRAY['brouillon','envoye','signe','refuse','expire','annule']));

CREATE UNIQUE INDEX IF NOT EXISTS idx_convoyeur_contrats_ys_request
  ON public.convoyeur_contrats (yousign_signature_request_id)
  WHERE yousign_signature_request_id IS NOT NULL;