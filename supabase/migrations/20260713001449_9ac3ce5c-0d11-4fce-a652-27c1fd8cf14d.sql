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
  v_email text;
  v_experience integer;
BEGIN
  v_societe := COALESCE(NEW.raw_user_meta_data->>'societe', '');
  v_type_client := COALESCE(NEW.raw_user_meta_data->>'type_client', '');
  v_email := lower(COALESCE(NEW.email, ''));

  IF v_type_client NOT IN ('particulier', 'b2b', 'flotte') THEN
    v_type_client := NULL;
  END IF;

  INSERT INTO public.profiles (user_id, email, prenom, nom, telephone, statut, societe, siret, type_client, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'telephone', ''),
    'actif',
    v_societe,
    COALESCE(NEW.raw_user_meta_data->>'siret', ''),
    COALESCE(v_type_client, 'particulier'),
    'active'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email,
      prenom = COALESCE(NULLIF(EXCLUDED.prenom, ''), public.profiles.prenom),
      nom = COALESCE(NULLIF(EXCLUDED.nom, ''), public.profiles.nom),
      telephone = COALESCE(NULLIF(EXCLUDED.telephone, ''), public.profiles.telephone),
      account_status = 'active';

  IF v_email IN ('contact@transports.ligneo.fr', 'contact@transportsligneo.fr') THEN
    v_role_text := 'super_admin';
  ELSE
    v_role_text := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
    IF v_role_text NOT IN ('convoyeur', 'client', 'admin', 'super_admin', 'manager', 'sous_traitant') THEN
      v_role_text := 'client';
    END IF;
  END IF;

  v_role := v_role_text::public.app_role;

  INSERT INTO public.user_roles (user_id, role, actif)
  VALUES (NEW.id, v_role, true)
  ON CONFLICT (user_id, role) DO UPDATE SET actif = true;

  IF v_role IN ('super_admin', 'convoyeur') THEN
    UPDATE public.user_roles
    SET actif = false
    WHERE user_id = NEW.id
      AND role <> v_role
      AND actif = true;
  END IF;

  IF v_role = 'convoyeur' THEN
    BEGIN
      v_experience := NULLIF(NEW.raw_user_meta_data->>'annees_experience', '')::integer;
    EXCEPTION WHEN OTHERS THEN
      v_experience := NULL;
    END;

    INSERT INTO public.convoyeurs (
      user_id, nom, prenom, telephone, email, statut, account_status,
      ville, disponibilite, permis, message, permis_numero, annees_experience, type_convoyeur
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'nom', ''),
      COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
      COALESCE(NEW.raw_user_meta_data->>'telephone', ''),
      COALESCE(NEW.email, ''),
      'en_attente',
      'active',
      COALESCE(NEW.raw_user_meta_data->>'ville', ''),
      COALESCE(NEW.raw_user_meta_data->>'disponibilite', ''),
      COALESCE(NEW.raw_user_meta_data->>'permis', ''),
      COALESCE(NEW.raw_user_meta_data->>'message', ''),
      NULLIF(NEW.raw_user_meta_data->>'permis_numero', ''),
      v_experience,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'type_convoyeur', ''), 'salarie')
    )
    ON CONFLICT (user_id) DO UPDATE
    SET nom = COALESCE(NULLIF(EXCLUDED.nom, ''), public.convoyeurs.nom),
        prenom = COALESCE(NULLIF(EXCLUDED.prenom, ''), public.convoyeurs.prenom),
        telephone = COALESCE(NULLIF(EXCLUDED.telephone, ''), public.convoyeurs.telephone),
        email = EXCLUDED.email,
        statut = CASE WHEN public.convoyeurs.statut IS NULL THEN 'en_attente' ELSE public.convoyeurs.statut END,
        account_status = 'active',
        ville = COALESCE(NULLIF(EXCLUDED.ville, ''), public.convoyeurs.ville),
        disponibilite = COALESCE(NULLIF(EXCLUDED.disponibilite, ''), public.convoyeurs.disponibilite),
        permis = COALESCE(NULLIF(EXCLUDED.permis, ''), public.convoyeurs.permis),
        message = COALESCE(NULLIF(EXCLUDED.message, ''), public.convoyeurs.message),
        permis_numero = COALESCE(EXCLUDED.permis_numero, public.convoyeurs.permis_numero),
        annees_experience = COALESCE(EXCLUDED.annees_experience, public.convoyeurs.annees_experience),
        type_convoyeur = COALESCE(NULLIF(EXCLUDED.type_convoyeur, ''), public.convoyeurs.type_convoyeur),
        updated_at = now();
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();