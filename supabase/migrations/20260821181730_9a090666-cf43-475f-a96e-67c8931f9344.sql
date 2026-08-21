update public.app_settings
set value = jsonb_set(value, '{sms_from}', '"TRSP LIGNEO"'::jsonb, true)
where key = 'google_review';