CREATE TABLE public.payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'revolut' CHECK (provider IN ('revolut','stripe')),
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox','production')),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'EUR',
  description text,
  statut text NOT NULL DEFAULT 'pending' CHECK (statut IN ('pending','processing','paid','failed','cancelled','expired')),
  revolut_order_id text,
  checkout_url text,
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  paid_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payment_links_revolut_order_id_key ON public.payment_links (revolut_order_id) WHERE revolut_order_id IS NOT NULL;
CREATE INDEX payment_links_mission_id_idx ON public.payment_links (mission_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_links TO authenticated;
GRANT ALL ON public.payment_links TO service_role;
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage payment links" ON public.payment_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.payment_link_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_link_id uuid NOT NULL REFERENCES public.payment_links(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('attach','detach')),
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_link_attachments_link_idx ON public.payment_link_attachments (payment_link_id);

GRANT SELECT, INSERT ON public.payment_link_attachments TO authenticated;
GRANT ALL ON public.payment_link_attachments TO service_role;
ALTER TABLE public.payment_link_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read payment link history" ON public.payment_link_attachments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins write payment link history" ON public.payment_link_attachments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.payment_link_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'revolut',
  event_key text NOT NULL,
  event_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payment_link_events_unique ON public.payment_link_events (provider, event_key);

GRANT SELECT ON public.payment_link_events TO authenticated;
GRANT ALL ON public.payment_link_events TO service_role;
ALTER TABLE public.payment_link_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read payment link events" ON public.payment_link_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_payment_links_updated_at BEFORE UPDATE ON public.payment_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_links;