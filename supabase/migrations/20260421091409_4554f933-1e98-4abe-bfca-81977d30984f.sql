-- Add type_demande column to contact_messages
ALTER TABLE public.contact_messages
ADD COLUMN IF NOT EXISTS type_demande text NOT NULL DEFAULT 'convoyage';

-- Add a check constraint for valid types
ALTER TABLE public.contact_messages
DROP CONSTRAINT IF EXISTS contact_messages_type_demande_check;

ALTER TABLE public.contact_messages
ADD CONSTRAINT contact_messages_type_demande_check
CHECK (type_demande IN ('convoyage', 'devis', 'b2b', 'partenariat'));

-- Backfill existing rows based on profil/segment heuristics
UPDATE public.contact_messages
SET type_demande = CASE
  WHEN profil = 'professionnel' OR (societe IS NOT NULL AND length(trim(societe)) > 0) THEN 'b2b'
  WHEN segment ILIKE '%partenariat%' OR segment ILIKE '%partner%' THEN 'partenariat'
  WHEN segment ILIKE '%devis%' THEN 'devis'
  ELSE 'convoyage'
END
WHERE type_demande = 'convoyage';

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_contact_messages_type_demande
ON public.contact_messages(type_demande);

CREATE INDEX IF NOT EXISTS idx_contact_messages_statut
ON public.contact_messages(statut);