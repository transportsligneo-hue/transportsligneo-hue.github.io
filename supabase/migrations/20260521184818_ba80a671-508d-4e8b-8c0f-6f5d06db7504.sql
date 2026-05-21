ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS amount_paid_cents integer,
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_factures_stripe_session ON public.factures(stripe_session_id);