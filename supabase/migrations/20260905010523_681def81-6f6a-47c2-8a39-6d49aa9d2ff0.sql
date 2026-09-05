ALTER TABLE public.trajets
  ADD COLUMN IF NOT EXISTS decharge_recuperation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recuperation_lieu text,
  ADD COLUMN IF NOT EXISTS recuperation_motif text;

CREATE TABLE IF NOT EXISTS public.signature_handoff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  attribution_id uuid REFERENCES public.attributions(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  slot text NOT NULL,
  doc_label text,
  signer_name text,
  status text NOT NULL DEFAULT 'pending',
  signature_data text,
  latitude double precision,
  longitude double precision,
  signed_at timestamp with time zone,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_handoff_sessions TO authenticated;
GRANT ALL ON public.signature_handoff_sessions TO service_role;

ALTER TABLE public.signature_handoff_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or admin can read signature handoff"
  ON public.signature_handoff_sessions FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner can create signature handoff"
  ON public.signature_handoff_sessions FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owner or admin can update signature handoff"
  ON public.signature_handoff_sessions FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner or admin can delete signature handoff"
  ON public.signature_handoff_sessions FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_signature_handoff_attribution
  ON public.signature_handoff_sessions (attribution_id);

CREATE TRIGGER update_signature_handoff_updated_at
  BEFORE UPDATE ON public.signature_handoff_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.signature_handoff_sessions;
ALTER TABLE public.signature_handoff_sessions REPLICA IDENTITY FULL;