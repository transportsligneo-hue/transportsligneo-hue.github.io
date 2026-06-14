ALTER TABLE public.trajets
  ADD COLUMN IF NOT EXISTS arrivee_contact_prenom TEXT,
  ADD COLUMN IF NOT EXISTS arrivee_contact_societe TEXT;