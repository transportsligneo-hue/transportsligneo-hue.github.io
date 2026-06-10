-- Lot 1: Workflow d'acceptation de devis

-- 1. Paramètre global
INSERT INTO public.app_settings (key, value)
VALUES ('devis_acceptation_obligatoire', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. Exemption par client
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS exempte_acceptation_devis boolean NOT NULL DEFAULT false;

-- 3. Versioning devis
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- 4. Table d'acceptations
CREATE TABLE IF NOT EXISTS public.devis_acceptations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  devis_version integer NOT NULL DEFAULT 1,
  client_user_id uuid,
  client_email text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  montant_accepte numeric(10,2) NOT NULL,
  cgv_version text NOT NULL DEFAULT 'v1-2026-01',
  statut text NOT NULL DEFAULT 'accepte' CHECK (statut IN ('accepte','revoque')),
  pdf_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.devis_acceptations TO authenticated;
GRANT ALL ON public.devis_acceptations TO service_role;

ALTER TABLE public.devis_acceptations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client read own acceptations"
  ON public.devis_acceptations FOR SELECT
  TO authenticated
  USING (
    client_user_id = auth.uid()
    OR lower(client_email) = lower(coalesce((auth.jwt()->>'email')::text, ''))
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "Client insert own acceptation"
  ON public.devis_acceptations FOR INSERT
  TO authenticated
  WITH CHECK (
    client_user_id = auth.uid()
    OR lower(client_email) = lower(coalesce((auth.jwt()->>'email')::text, ''))
  );

CREATE POLICY "Admin manage acceptations"
  ON public.devis_acceptations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_devis_acceptations_devis ON public.devis_acceptations(devis_id);
CREATE INDEX IF NOT EXISTS idx_devis_acceptations_client ON public.devis_acceptations(client_user_id);

-- 5. Trigger : bump version si modification d'un devis déjà accepté
CREATE OR REPLACE FUNCTION public.devis_bump_version_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL AND (
    NEW.depart IS DISTINCT FROM OLD.depart
    OR NEW.arrivee IS DISTINCT FROM OLD.arrivee
    OR NEW.prix_estime IS DISTINCT FROM OLD.prix_estime
    OR NEW.date_souhaitee IS DISTINCT FROM OLD.date_souhaitee
  ) THEN
    NEW.version := OLD.version + 1;
    NEW.locked_at := NULL;
    NEW.accepted_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devis_bump_version ON public.devis;
CREATE TRIGGER trg_devis_bump_version
  BEFORE UPDATE ON public.devis
  FOR EACH ROW
  EXECUTE FUNCTION public.devis_bump_version_on_change();

-- 6. Storage policies (le bucket devis-acceptes a été créé via l'API)
CREATE POLICY "Client read own accepted devis pdf"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'devis-acceptes' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  );