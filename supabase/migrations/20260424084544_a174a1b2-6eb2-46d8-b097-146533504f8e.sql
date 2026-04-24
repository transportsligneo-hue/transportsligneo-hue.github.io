CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
  v_role_text text;
  v_societe text;
BEGIN
  v_societe := COALESCE(NEW.raw_user_meta_data->>'societe', '');

  INSERT INTO public.profiles (user_id, email, prenom, nom, telephone, statut, societe, siret)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'telephone', ''),
    'actif',
    v_societe,
    COALESCE(NEW.raw_user_meta_data->>'siret', '')
  )
  ON CONFLICT (user_id) DO NOTHING;

  v_role_text := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
  IF v_role_text NOT IN ('convoyeur', 'client') THEN
    v_role_text := 'client';
  END IF;
  v_role := v_role_text::public.app_role;

  INSERT INTO public.user_roles (user_id, role, actif)
  VALUES (NEW.id, v_role, true)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND actif = true
  )
$function$;

DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own non-admin role" ON public.user_roles;

CREATE POLICY "Users can insert own non-admin role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role IN ('client'::public.app_role, 'convoyeur'::public.app_role));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'mission_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.mission_locations;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Convoyeurs can delete own permis files'
  ) THEN
    CREATE POLICY "Convoyeurs can delete own permis files"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'convoyeur-permis'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;