CREATE TABLE public.mission_rappels_j1 (
  attribution_id UUID PRIMARY KEY REFERENCES public.attributions(id) ON DELETE CASCADE,
  trajet_id UUID,
  convoyeur_id UUID,
  email_ok BOOLEAN NOT NULL DEFAULT false,
  push_ok BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mission_rappels_j1 TO authenticated;
GRANT ALL ON public.mission_rappels_j1 TO service_role;

ALTER TABLE public.mission_rappels_j1 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read mission reminders"
ON public.mission_rappels_j1
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

SELECT cron.schedule(
  'rappel-mission-j1',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--89dab15e-bf0e-453b-bb30-b452a3afe7db.lovable.app/api/public/hooks/rappel-mission-j1',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtcXNhYnF3eGZzdmJua3l6amhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODIxNzEsImV4cCI6MjA5MTc1ODE3MX0.mEaDbjifqWmAMq-SvVgy8H7tGCV4nJaePYzeX-P46M8"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);