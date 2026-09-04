ALTER TABLE public.trajets ADD COLUMN IF NOT EXISTS non_roulant boolean NOT NULL DEFAULT false;

CREATE TABLE public.edl_non_roulant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL REFERENCES public.attributions(id) ON DELETE CASCADE,
  arrimage jsonb NOT NULL DEFAULT '{}'::jsonb,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  observations text,
  convoyeur_nom text,
  convoyeur_signature text,
  convoyeur_signed_at timestamptz,
  convoyeur_latitude double precision,
  convoyeur_longitude double precision,
  remettant_nom text,
  remettant_signature text,
  remettant_signed_at timestamptz,
  remettant_latitude double precision,
  remettant_longitude double precision,
  pdf_url text,
  statut text NOT NULL DEFAULT 'brouillon',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT edl_non_roulant_attribution_unique UNIQUE (attribution_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.edl_non_roulant TO authenticated;
GRANT ALL ON public.edl_non_roulant TO service_role;
ALTER TABLE public.edl_non_roulant ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage edl non roulant" ON public.edl_non_roulant
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Convoyeurs manage own edl non roulant" ON public.edl_non_roulant
FOR ALL TO authenticated
USING (attribution_id IN (SELECT a.id FROM public.attributions a JOIN public.convoyeurs c ON c.id = a.convoyeur_id WHERE c.user_id = auth.uid()))
WITH CHECK (attribution_id IN (SELECT a.id FROM public.attributions a JOIN public.convoyeurs c ON c.id = a.convoyeur_id WHERE c.user_id = auth.uid()));

CREATE POLICY "Clients read edl non roulant of own missions" ON public.edl_non_roulant
FOR SELECT TO authenticated
USING (is_attribution_client(auth.uid(), attribution_id));

CREATE TABLE public.mission_devis_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL REFERENCES public.attributions(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'app',
  signer_name text,
  signature_data text,
  document_url text,
  latitude double precision,
  longitude double precision,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mission_devis_signatures_attribution_unique UNIQUE (attribution_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_devis_signatures TO authenticated;
GRANT ALL ON public.mission_devis_signatures TO service_role;
ALTER TABLE public.mission_devis_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage devis signatures" ON public.mission_devis_signatures
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Convoyeurs manage devis signatures of own missions" ON public.mission_devis_signatures
FOR ALL TO authenticated
USING (attribution_id IN (SELECT a.id FROM public.attributions a JOIN public.convoyeurs c ON c.id = a.convoyeur_id WHERE c.user_id = auth.uid()))
WITH CHECK (attribution_id IN (SELECT a.id FROM public.attributions a JOIN public.convoyeurs c ON c.id = a.convoyeur_id WHERE c.user_id = auth.uid()));

CREATE POLICY "Clients read devis signatures of own missions" ON public.mission_devis_signatures
FOR SELECT TO authenticated
USING (is_attribution_client(auth.uid(), attribution_id));

CREATE TRIGGER update_edl_non_roulant_updated_at BEFORE UPDATE ON public.edl_non_roulant
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mission_devis_signatures_updated_at BEFORE UPDATE ON public.mission_devis_signatures
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();