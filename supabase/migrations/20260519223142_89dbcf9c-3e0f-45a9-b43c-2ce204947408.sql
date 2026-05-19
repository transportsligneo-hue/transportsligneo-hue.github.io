
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS depart_retour TEXT,
  ADD COLUMN IF NOT EXISTS arrivee_retour TEXT,
  ADD COLUMN IF NOT EXISTS immatriculation_retour TEXT,
  ADD COLUMN IF NOT EXISTS marque_retour TEXT,
  ADD COLUMN IF NOT EXISTS modele_retour TEXT,
  ADD COLUMN IF NOT EXISTS vin_retour TEXT;

ALTER TABLE public.demandes_convoyage
  ADD COLUMN IF NOT EXISTS depart_retour TEXT,
  ADD COLUMN IF NOT EXISTS arrivee_retour TEXT,
  ADD COLUMN IF NOT EXISTS immatriculation_retour TEXT,
  ADD COLUMN IF NOT EXISTS marque_retour TEXT,
  ADD COLUMN IF NOT EXISTS modele_retour TEXT,
  ADD COLUMN IF NOT EXISTS vin_retour TEXT;
