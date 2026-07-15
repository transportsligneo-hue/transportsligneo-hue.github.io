
-- 1. Table des défis OTP pour la signature des devis
CREATE TABLE public.devis_otp_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  devis_id UUID NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'email',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_devis_otp_challenges_devis ON public.devis_otp_challenges(devis_id, created_at DESC);
CREATE INDEX idx_devis_otp_challenges_active ON public.devis_otp_challenges(devis_id) WHERE consumed_at IS NULL;

GRANT SELECT ON public.devis_otp_challenges TO authenticated;
GRANT ALL ON public.devis_otp_challenges TO service_role;

ALTER TABLE public.devis_otp_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client sees own OTP challenges"
  ON public.devis_otp_challenges FOR SELECT
  TO authenticated
  USING (auth.uid() = client_user_id);

CREATE POLICY "Admins see all OTP challenges"
  ON public.devis_otp_challenges FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Enrichissement de devis_acceptations (méthode de validation)
ALTER TABLE public.devis_acceptations
  ADD COLUMN IF NOT EXISTS validation_method TEXT NOT NULL DEFAULT 'signature_manuscrite',
  ADD COLUMN IF NOT EXISTS otp_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS otp_verified_at TIMESTAMPTZ;

-- 3. Suivi du refus côté devis
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS refused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refus_motif TEXT;
