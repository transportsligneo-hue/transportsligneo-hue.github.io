SELECT cron.unschedule('gmail-po-sync') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gmail-po-sync');

SELECT cron.schedule(
  'gmail-po-sync',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--89dab15e-bf0e-453b-bb30-b452a3afe7db.lovable.app/api/public/hooks/gmail-po-sync',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtcXNhYnF3eGZzdmJua3l6amhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODIxNzEsImV4cCI6MjA5MTc1ODE3MX0.mEaDbjifqWmAMq-SvVgy8H7tGCV4nJaePYzeX-P46M8"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);