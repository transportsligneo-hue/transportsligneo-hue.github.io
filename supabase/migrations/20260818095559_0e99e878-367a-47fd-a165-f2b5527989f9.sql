INSERT INTO public.app_settings (key, value)
VALUES (
  'registration_gate',
  jsonb_build_object(
    'client', true,
    'pro', true,
    'flotte', true,
    'convoyeur', false
  )
)
ON CONFLICT (key) DO NOTHING;