ALTER TABLE public.trajets ADD COLUMN IF NOT EXISTS arrivee_contact_email text;

CREATE TABLE public.mission_review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL REFERENCES public.attributions(id) ON DELETE CASCADE,
  trajet_id uuid,
  recipient_type text NOT NULL CHECK (recipient_type IN ('client','contact_livraison')),
  recipient_email text NOT NULL,
  recipient_name text,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','review_left')),
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  review_left_at timestamp with time zone,
  auto boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (attribution_id, recipient_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_review_requests TO authenticated;
GRANT ALL ON public.mission_review_requests TO service_role;

ALTER TABLE public.mission_review_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage review requests"
ON public.mission_review_requests FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_mission_review_requests_updated_at
BEFORE UPDATE ON public.mission_review_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_mission_review_requests_attribution ON public.mission_review_requests(attribution_id);

INSERT INTO public.app_settings (key, value)
VALUES ('google_review', '{"url": "", "auto_enabled": false, "delay_hours": 2, "send_to_contact": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;