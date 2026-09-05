SELECT cron.unschedule('rappel-mission-j1');

SELECT cron.schedule(
  'rappel-mission-j1',
  '0 17 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--89dab15e-bf0e-453b-bb30-b452a3afe7db.lovable.app/api/public/hooks/rappel-mission-j1',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtcXNhYnF3eGZzdmJua3l6amhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODIxNzEsImV4cCI6MjA5MTc1ODE3MX0.mEaDbjifqWmAMq-SvVgy8H7tGCV4nJaePYzeX-P46M8"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
