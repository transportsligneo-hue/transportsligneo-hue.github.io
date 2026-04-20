-- Ajouter les champs B2B sur profiles (sans casser l'existant)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS societe text DEFAULT '',
  ADD COLUMN IF NOT EXISTS siret text DEFAULT '',
  ADD COLUMN IF NOT EXISTS type_client text NOT NULL DEFAULT 'particulier';

-- Contrainte sur type_client (particulier ou b2b)
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_type_client_check
    CHECK (type_client IN ('particulier', 'b2b'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger : si societe non vide à l'insertion/update, on bascule en b2b automatiquement
CREATE OR REPLACE FUNCTION public.auto_set_type_client()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.societe IS NOT NULL AND length(trim(NEW.societe)) > 0 THEN
    NEW.type_client := 'b2b';
  ELSIF NEW.type_client IS NULL THEN
    NEW.type_client := 'particulier';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_set_type_client ON public.profiles;
CREATE TRIGGER trg_auto_set_type_client
  BEFORE INSERT OR UPDATE OF societe ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_type_client();

-- Mettre à jour handle_new_user pour récupérer societe depuis raw_user_meta_data
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
  IF v_role_text NOT IN ('admin', 'convoyeur', 'client') THEN
    v_role_text := 'client';
  END IF;
  v_role := v_role_text::public.app_role;

  INSERT INTO public.user_roles (user_id, role, actif)
  VALUES (NEW.id, v_role, true)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;