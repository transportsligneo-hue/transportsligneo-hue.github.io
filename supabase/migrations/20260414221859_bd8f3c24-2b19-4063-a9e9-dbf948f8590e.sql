ALTER TABLE public.convoyeurs
  ADD COLUMN IF NOT EXISTS ville text DEFAULT '',
  ADD COLUMN IF NOT EXISTS disponibilite text DEFAULT '',
  ADD COLUMN IF NOT EXISTS permis text DEFAULT '',
  ADD COLUMN IF NOT EXISTS message text DEFAULT '';