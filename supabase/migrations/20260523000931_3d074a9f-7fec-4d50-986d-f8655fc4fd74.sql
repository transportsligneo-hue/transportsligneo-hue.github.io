
-- 1. PV de livraison digitalisés
CREATE TABLE IF NOT EXISTS public.mission_pv_digitaux (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL,
  plateforme text NOT NULL CHECK (plateforme IN ('model_arval','welcomauto_ayvens')),
  actif boolean NOT NULL DEFAULT false,
  url text,
  code text,
  plaque text,
  instruction text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attribution_id, plateforme)
);

ALTER TABLE public.mission_pv_digitaux ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pv digitaux"
ON public.mission_pv_digitaux FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Convoyeurs read own pv digitaux"
ON public.mission_pv_digitaux FOR SELECT TO authenticated
USING (attribution_id IN (
  SELECT a.id FROM attributions a
  JOIN convoyeurs c ON c.id = a.convoyeur_id
  WHERE c.user_id = auth.uid()
));

CREATE TRIGGER update_mission_pv_digitaux_updated_at
BEFORE UPDATE ON public.mission_pv_digitaux
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Extension mission_documents
ALTER TABLE public.mission_documents
  ADD COLUMN IF NOT EXISTS visible_driver boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_client boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ajoute_par text NOT NULL DEFAULT 'admin' CHECK (ajoute_par IN ('admin','client','convoyeur'));

-- Policies client pour mission_documents (insert + select de leurs propres missions)
DO $$ BEGIN
  CREATE POLICY "Clients insert own mission documents"
  ON public.mission_documents FOR INSERT TO authenticated
  WITH CHECK (
    ajoute_par = 'client'
    AND uploaded_by = auth.uid()
    AND attribution_id IN (
      SELECT a.id FROM attributions a
      JOIN trajets t ON t.id = a.trajet_id
      LEFT JOIN devis d ON d.id = t.devis_id
      LEFT JOIN demandes_convoyage dc ON dc.id = t.demande_id
      WHERE d.user_id = auth.uid()
         OR dc.user_id = auth.uid()
         OR lower(d.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
         OR lower(dc.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Clients read own mission documents"
  ON public.mission_documents FOR SELECT TO authenticated
  USING (
    visible_client = true
    AND attribution_id IN (
      SELECT a.id FROM attributions a
      JOIN trajets t ON t.id = a.trajet_id
      LEFT JOIN devis d ON d.id = t.devis_id
      LEFT JOIN demandes_convoyage dc ON dc.id = t.demande_id
      WHERE d.user_id = auth.uid()
         OR dc.user_id = auth.uid()
         OR lower(d.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
         OR lower(dc.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Convoyeurs read visible mission documents"
  ON public.mission_documents FOR SELECT TO authenticated
  USING (
    visible_driver = true
    AND attribution_id IN (
      SELECT a.id FROM attributions a
      JOIN convoyeurs c ON c.id = a.convoyeur_id
      WHERE c.user_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Catalogue public sur attributions
ALTER TABLE public.attributions
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- 4. Storage : bucket mission-documents existe déjà. Policies de base si manquantes.
DO $$ BEGIN
  CREATE POLICY "Admins manage mission-documents storage"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'mission-documents' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  WITH CHECK (bucket_id = 'mission-documents' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated upload to mission-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mission-documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated read mission-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mission-documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
