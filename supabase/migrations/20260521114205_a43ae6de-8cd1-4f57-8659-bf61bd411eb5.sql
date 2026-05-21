ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS equipements jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS kilometrage_depart integer,
  ADD COLUMN IF NOT EXISTS kilometrage_arrivee integer;

ALTER TABLE public.trajets
  ADD COLUMN IF NOT EXISTS arrivee_contact_nom text,
  ADD COLUMN IF NOT EXISTS arrivee_contact_telephone text,
  ADD COLUMN IF NOT EXISTS arrivee_contact_telephone2 text,
  ADD COLUMN IF NOT EXISTS arrivee_contact_instructions text;