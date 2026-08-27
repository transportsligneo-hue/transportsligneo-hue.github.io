ALTER TABLE public.bons_commande
  ADD COLUMN IF NOT EXISTS adresse_livraison text,
  ADD COLUMN IF NOT EXISTS designation text,
  ADD COLUMN IF NOT EXISTS contact_livraison text;