-- A3 — Support type_client = 'flotte' en plus de particulier/b2b
-- + meta override sur handle_new_user pour respecter le choix d'inscription

-- 1. auto_set_type_client : respecter meta si valide (particulier/b2b/flotte)
CREATE OR REPLACE FUNCTION public.auto_set_type_client()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Si déjà défini explicitement à une valeur valide, on garde
  IF NEW.type_client IN ('particulier', 'b2b', 'flotte') THEN
    RETURN NEW;
  END IF;

  -- Sinon, déduction depuis la présence de societe
  IF NEW.societe IS NOT NULL AND length(trim(NEW.societe)) > 0 THEN
    NEW.type_client := 'b2b';
  ELSE
    NEW.type_client := 'particulier';
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. handle_new_user : prend en compte le meta type_client (priorité au choix d'inscription)
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
  v_type_client text;
BEGIN
  v_societe := COALESCE(NEW.raw_user_meta_data->>'societe', '');
  v_type_client := COALESCE(NEW.raw_user_meta_data->>'type_client', '');

  -- Normalisation
  IF v_type_client NOT IN ('particulier', 'b2b', 'flotte') THEN
    v_type_client := NULL;
  END IF;

  INSERT INTO public.profiles (user_id, email, prenom, nom, telephone, statut, societe, siret, type_client)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'telephone', ''),
    'actif',
    v_societe,
    COALESCE(NEW.raw_user_meta_data->>'siret', ''),
    v_type_client
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