UPDATE public.app_settings
SET value = jsonb_set(value, '{sms_from}', '"LIGNEO"'::jsonb, true)
WHERE key = 'google_review';