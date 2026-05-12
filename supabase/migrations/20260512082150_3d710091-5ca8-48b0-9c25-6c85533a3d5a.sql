ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS adresse text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_type_client_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_type_client_check CHECK (type_client = ANY (ARRAY['particulier'::text, 'b2b'::text, 'flotte'::text]));