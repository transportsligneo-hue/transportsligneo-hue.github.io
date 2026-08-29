ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS lien_paiement_externe text;
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS lien_paiement_externe text;
COMMENT ON COLUMN public.devis.lien_paiement_externe IS 'Lien de paiement externe (Qonto, Revolut, etc.) proposé au client à la place du checkout Stripe.';
COMMENT ON COLUMN public.factures.lien_paiement_externe IS 'Lien de paiement externe (Qonto, Revolut, etc.) proposé au client à la place du checkout Stripe.';