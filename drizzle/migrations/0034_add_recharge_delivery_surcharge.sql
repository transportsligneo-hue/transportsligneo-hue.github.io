ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS recharge_delivery_surcharge numeric(10,2) NOT NULL DEFAULT 25.00;

COMMENT ON COLUMN public.pricing_settings.recharge_delivery_surcharge IS 'Supplément TTC configurable pour la recharge électrique destinée à la livraison.';