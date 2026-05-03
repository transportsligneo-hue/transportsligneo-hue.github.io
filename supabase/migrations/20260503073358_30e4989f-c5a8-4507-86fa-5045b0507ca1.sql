
-- 1. Selfies identité
CREATE TABLE public.mission_selfies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL,
  convoyeur_user_id uuid NOT NULL,
  storage_path text NOT NULL,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  taken_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mission_selfies_attribution ON public.mission_selfies(attribution_id);
ALTER TABLE public.mission_selfies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage selfies" ON public.mission_selfies
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Convoyeurs manage own selfies" ON public.mission_selfies
  FOR ALL TO authenticated
  USING (convoyeur_user_id = auth.uid())
  WITH CHECK (convoyeur_user_id = auth.uid());

CREATE POLICY "Clients read selfies of own missions" ON public.mission_selfies
  FOR SELECT TO authenticated
  USING (attribution_id IN (
    SELECT a.id FROM public.attributions a
    JOIN public.trajets t ON t.id = a.trajet_id
    JOIN public.demandes_convoyage d ON d.id = t.demande_id
    JOIN public.profiles p ON p.email = d.email
    WHERE p.user_id = auth.uid()
  ));

-- 2. Signatures
CREATE TABLE public.mission_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('driver_start','client_start','driver_end','client_end')),
  signer_name text NOT NULL,
  signature_data text NOT NULL,
  signed_by_user_id uuid,
  latitude double precision,
  longitude double precision,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attribution_id, kind)
);
CREATE INDEX idx_mission_signatures_attribution ON public.mission_signatures(attribution_id);
ALTER TABLE public.mission_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage signatures" ON public.mission_signatures
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Convoyeurs manage signatures of own missions" ON public.mission_signatures
  FOR ALL TO authenticated
  USING (attribution_id IN (
    SELECT a.id FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
  ))
  WITH CHECK (attribution_id IN (
    SELECT a.id FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
  ));

CREATE POLICY "Clients read signatures of own missions" ON public.mission_signatures
  FOR SELECT TO authenticated
  USING (attribution_id IN (
    SELECT a.id FROM public.attributions a
    JOIN public.trajets t ON t.id = a.trajet_id
    JOIN public.demandes_convoyage d ON d.id = t.demande_id
    JOIN public.profiles p ON p.email = d.email
    WHERE p.user_id = auth.uid()
  ));

-- 3. Overrides admin
CREATE TABLE public.mission_step_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL,
  step_key text NOT NULL,
  override_mode text NOT NULL DEFAULT 'skip' CHECK (override_mode IN ('skip','force','disable')),
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attribution_id, step_key)
);
CREATE INDEX idx_mission_step_overrides_attribution ON public.mission_step_overrides(attribution_id);
ALTER TABLE public.mission_step_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage overrides" ON public.mission_step_overrides
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Convoyeurs read overrides of own missions" ON public.mission_step_overrides
  FOR SELECT TO authenticated
  USING (attribution_id IN (
    SELECT a.id FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
  ));

-- 4. Storage bucket selfies
INSERT INTO storage.buckets (id, name, public)
VALUES ('mission-selfies', 'mission-selfies', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Convoyeurs upload own selfies"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'mission-selfies' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Convoyeurs read own selfies"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'mission-selfies' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins read all selfies"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'mission-selfies' AND has_role(auth.uid(), 'admin'::app_role));
