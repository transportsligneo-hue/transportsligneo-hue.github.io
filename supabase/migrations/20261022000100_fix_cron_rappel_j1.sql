-- Rappel J-1 convoyeur : le job pointait vers l'ancien domaine et n'envoyait pas le secret attendu
-- par le serveur (en-tête x-cron-secret), donc chaque appel était refusé (401).
INSERT INTO public.api_internal_config (key, value)
VALUES ('cron_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
ON CONFLICT (key) DO NOTHING;

SELECT cron.unschedule('rappel-mission-j1');

SELECT cron.schedule(
  'rappel-mission-j1',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url := 'https://transportsligneo.fr/api/public/hooks/rappel-mission-j1',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.api_internal_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
