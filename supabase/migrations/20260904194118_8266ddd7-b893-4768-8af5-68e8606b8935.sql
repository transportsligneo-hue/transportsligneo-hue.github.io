ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS client_nom text,
  ADD COLUMN IF NOT EXISTS client_prenom text,
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS client_telephone text,
  ADD COLUMN IF NOT EXISTS devis_id uuid REFERENCES public.devis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS facture_id uuid REFERENCES public.factures(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payment_links_devis_id_idx ON public.payment_links(devis_id);
CREATE INDEX IF NOT EXISTS payment_links_facture_id_idx ON public.payment_links(facture_id);

CREATE TABLE IF NOT EXISTS public.payment_link_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_link_id uuid NOT NULL REFERENCES public.payment_links(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('sms','email')),
  destination text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed')),
  error text,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_link_sends_link_idx ON public.payment_link_sends(payment_link_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_link_sends TO authenticated;
GRANT ALL ON public.payment_link_sends TO service_role;
ALTER TABLE public.payment_link_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage payment link sends" ON public.payment_link_sends;
CREATE POLICY "Admins manage payment link sends" ON public.payment_link_sends
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));