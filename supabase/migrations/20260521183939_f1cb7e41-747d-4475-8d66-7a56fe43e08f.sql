
-- Reference client externe sur factures (n° BC, n° dossier client, etc.)
ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS reference_client text,
  ADD COLUMN IF NOT EXISTS reference_label text;

-- Désactivation des relances par client
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS relances_disabled boolean NOT NULL DEFAULT false;

-- Réglages globaux de relances factures (insertion défauts si absents)
INSERT INTO public.app_settings (key, value)
VALUES
  ('factures.auto_relances', '{"enabled": true}'::jsonb),
  ('factures.auto_retard',   '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Lecture publique authentifiée de ces deux clés (UI client/pro peut lire le mode actif)
DROP POLICY IF EXISTS "Authenticated can read facture flags" ON public.app_settings;
CREATE POLICY "Authenticated can read facture flags"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (key IN ('factures.auto_relances', 'factures.auto_retard'));
