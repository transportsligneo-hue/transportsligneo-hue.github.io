ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

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
BEGIN
  v_societe := COALESCE(NEW.raw_user_meta_data->>'societe', '');
  v_type_client := COALESCE(NEW.raw_user_meta_data->>'type_client', '');
  v_email := lower(COALESCE(NEW.email, ''));

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
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email;

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

  IF v_role = 'super_admin' THEN
    UPDATE public.user_roles
    SET actif = false
    WHERE user_id = NEW.id
      AND role <> 'super_admin'
      AND actif = true;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_is_super boolean := false;
  v_protected_emails text[] := ARRAY['contact@transports.ligneo.fr', 'contact@transportsligneo.fr'];
  v_target_email text;
BEGIN
  IF v_actor IS NULL OR auth.role() = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_actor AND role = 'super_admin' AND actif = true
  ) INTO v_actor_is_super;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'super_admin' AND NOT v_actor_is_super THEN
      RAISE EXCEPTION 'Seul un super administrateur peut attribuer le rôle super_admin';
    END IF;
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') AND OLD.role = 'super_admin' THEN
    IF NOT v_actor_is_super THEN
      RAISE EXCEPTION 'Seul un super administrateur peut modifier un rôle super_admin';
    END IF;

    IF OLD.user_id = v_actor THEN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Un super administrateur ne peut pas supprimer son propre rôle';
      END IF;
      IF TG_OP = 'UPDATE' AND (NEW.actif = false OR NEW.role <> 'super_admin') THEN
        RAISE EXCEPTION 'Un super administrateur ne peut pas se rétrograder lui-même';
      END IF;
    END IF;

    SELECT lower(email) INTO v_target_email FROM public.profiles WHERE user_id = OLD.user_id LIMIT 1;
    IF v_target_email = ANY(v_protected_emails) THEN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Le compte principal ne peut pas perdre son rôle super_admin';
      END IF;
      IF TG_OP = 'UPDATE' AND (NEW.actif = false OR NEW.role <> 'super_admin') THEN
        RAISE EXCEPTION 'Le compte principal ne peut pas être rétrogradé';
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE v_uid uuid;
BEGIN
  FOR v_uid IN
    SELECT user_id
    FROM public.profiles
    WHERE lower(email) IN ('contact@transports.ligneo.fr', 'contact@transportsligneo.fr')
  LOOP
    UPDATE public.user_roles
    SET actif = false
    WHERE user_id = v_uid
      AND role <> 'super_admin'
      AND actif = true;

    INSERT INTO public.user_roles (user_id, role, actif)
    VALUES (v_uid, 'super_admin', true)
    ON CONFLICT (user_id, role) DO UPDATE SET actif = true;
  END LOOP;
END $$;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') LIKE '%has_role(auth.uid(), ''admin''::app_role)%'
        OR coalesce(with_check, '') LIKE '%has_role(auth.uid(), ''admin''::app_role)%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR %s TO authenticated %s%s',
      pol.policyname,
      pol.schemaname,
      pol.tablename,
      pol.cmd,
      CASE
        WHEN pol.qual IS NOT NULL AND pol.with_check IS NOT NULL THEN format('USING (%s OR has_role(auth.uid(), ''super_admin''::app_role)) WITH CHECK (%s OR has_role(auth.uid(), ''super_admin''::app_role))', pol.qual, pol.with_check)
        WHEN pol.qual IS NOT NULL THEN format('USING (%s OR has_role(auth.uid(), ''super_admin''::app_role))', pol.qual)
        WHEN pol.with_check IS NOT NULL THEN format('WITH CHECK (%s OR has_role(auth.uid(), ''super_admin''::app_role))', pol.with_check)
        ELSE ''
      END,
      ''
    );
  END LOOP;
END $$;