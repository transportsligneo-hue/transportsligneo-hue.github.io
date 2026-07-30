ALTER TABLE public.trajets
ADD COLUMN IF NOT EXISTS prix_total numeric(10,2);