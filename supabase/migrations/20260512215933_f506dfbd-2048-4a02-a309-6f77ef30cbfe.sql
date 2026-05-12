CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_is_super boolean := false;
  v_protected_email text := 'contact@transports.ligneo.fr';
  v_target_email text;
BEGIN
  -- Bypass : appel sans contexte utilisateur (migrations / service role / edge fn trustées)
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

    SELECT email INTO v_target_email FROM public.profiles WHERE user_id = OLD.user_id LIMIT 1;
    IF v_target_email = v_protected_email THEN
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

DROP TRIGGER IF EXISTS protect_super_admin_role_trigger ON public.user_roles;
CREATE TRIGGER protect_super_admin_role_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_role();

DO $$
DECLARE v_uid uuid;
BEGIN
  SELECT user_id INTO v_uid FROM public.profiles WHERE email = 'contact@transports.ligneo.fr' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    UPDATE public.user_roles SET actif = false WHERE user_id = v_uid AND role <> 'super_admin' AND actif = true;
    INSERT INTO public.user_roles (user_id, role, actif)
    VALUES (v_uid, 'super_admin', true)
    ON CONFLICT (user_id, role) DO UPDATE SET actif = true;
  END IF;
END $$;