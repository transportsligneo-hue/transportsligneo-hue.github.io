CREATE TABLE public.signup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  full_name text,
  kind text NOT NULL,
  documents_expected integer NOT NULL DEFAULT 0,
  documents_uploaded integer NOT NULL DEFAULT 0,
  documents_rejected jsonb NOT NULL DEFAULT '[]'::jsonb,
  emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  notification_created boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.signup_events TO authenticated;
GRANT ALL ON public.signup_events TO service_role;

ALTER TABLE public.signup_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read signup events"
ON public.signup_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_signup_events_updated_at
BEFORE UPDATE ON public.signup_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_signup_events_created_at ON public.signup_events (created_at DESC);