CREATE TABLE public.client_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid,
  client_email text NOT NULL,
  ville_depart text,
  ville_arrivee text,
  zone_label text,
  trip_type text NOT NULL DEFAULT 'any' CHECK (trip_type IN ('aller','aller_retour','any')),
  prix_ttc numeric NOT NULL CHECK (prix_ttc > 0),
  prix_ht numeric,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.client_pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client pricing"
  ON public.client_pricing_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "Clients read own pricing"
  ON public.client_pricing_rules FOR SELECT TO authenticated
  USING (
    client_user_id = auth.uid()
    OR lower(client_email) = lower(coalesce(auth.jwt()->>'email',''))
  );

CREATE INDEX idx_client_pricing_email ON public.client_pricing_rules (lower(client_email));
CREATE INDEX idx_client_pricing_user ON public.client_pricing_rules (client_user_id);

CREATE TRIGGER update_client_pricing_rules_updated_at
  BEFORE UPDATE ON public.client_pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();