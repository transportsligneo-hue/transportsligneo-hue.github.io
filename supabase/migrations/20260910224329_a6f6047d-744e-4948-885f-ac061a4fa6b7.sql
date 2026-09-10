CREATE TABLE IF NOT EXISTS public.mission_eta_tracking (
  attribution_id uuid PRIMARY KEY REFERENCES public.attributions(id) ON DELETE CASCADE,
  initial_eta_at timestamptz NOT NULL,
  initial_remaining_km numeric,
  last_alert_bucket integer NOT NULL DEFAULT 0,
  last_alert_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.mission_eta_tracking TO service_role;

ALTER TABLE public.mission_eta_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eta tracking service only"
ON public.mission_eta_tracking FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE TRIGGER update_mission_eta_tracking_updated_at
BEFORE UPDATE ON public.mission_eta_tracking
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (key, value)
VALUES ('mission_delay_alert_minutes', '30'::jsonb)
ON CONFLICT (key) DO NOTHING;