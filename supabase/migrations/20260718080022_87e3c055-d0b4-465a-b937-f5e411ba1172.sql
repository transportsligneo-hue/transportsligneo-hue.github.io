-- 1) Table d'audit sécurité (super admin)
CREATE TABLE IF NOT EXISTS public.admin_security_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_security_audit TO authenticated;
GRANT ALL ON public.admin_security_audit TO service_role;
ALTER TABLE public.admin_security_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin can read audit" ON public.admin_security_audit;
CREATE POLICY "super_admin can read audit"
  ON public.admin_security_audit FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 2) Bloquer côté DB toute tentative d'un admin non-super de manipuler les rôles admin/super_admin.
--    On garde le SELECT/INSERT/UPDATE/DELETE ouverts aux admins pour les rôles inférieurs,
--    et on ajoute un trigger qui rejette les rôles sensibles si l'acteur n'est pas super_admin.
CREATE OR REPLACE FUNCTION public.guard_sensitive_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_super boolean := public.has_role(auth.uid(), 'super_admin'::app_role);
  touched_role app_role;
BEGIN
  IF TG_OP = 'DELETE' THEN
    touched_role := OLD.role;
  ELSE
    touched_role := NEW.role;
  END IF;

  IF touched_role IN ('admin'::app_role, 'super_admin'::app_role) AND NOT is_super THEN
    RAISE EXCEPTION 'Seul un Super Admin peut modifier les rôles admin/super_admin';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_sensitive_role_changes ON public.user_roles;
CREATE TRIGGER trg_guard_sensitive_role_changes
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_sensitive_role_changes();

-- 3) Empêcher un super admin de retirer son propre super_admin (garde-fou anti-lockout)
CREATE OR REPLACE FUNCTION public.prevent_self_super_admin_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.role = 'super_admin'::app_role AND OLD.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Un Super Admin ne peut pas retirer son propre rôle Super Admin';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.role = 'super_admin'::app_role AND OLD.user_id = auth.uid()
     AND (NEW.actif = false OR NEW.role <> 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Un Super Admin ne peut pas retirer son propre rôle Super Admin';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_super_admin_removal ON public.user_roles;
CREATE TRIGGER trg_prevent_self_super_admin_removal
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_super_admin_removal();

-- 4) RPC centralisée pour la gestion des rôles par un super admin (écrit l'audit)
CREATE OR REPLACE FUNCTION public.super_admin_set_role(
  _target_user_id uuid,
  _role app_role,
  _actif boolean DEFAULT true
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_prev_actif boolean;
BEGIN
  IF NOT public.has_role(v_actor, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Réservé aux Super Admins';
  END IF;

  SELECT actif INTO v_prev_actif FROM public.user_roles
   WHERE user_id = _target_user_id AND role = _role;

  IF v_prev_actif IS NULL THEN
    INSERT INTO public.user_roles(user_id, role, actif) VALUES (_target_user_id, _role, _actif);
  ELSE
    UPDATE public.user_roles SET actif = _actif
      WHERE user_id = _target_user_id AND role = _role;
  END IF;

  INSERT INTO public.admin_security_audit(actor_user_id, action, target_user_id, details)
  VALUES (
    v_actor,
    CASE WHEN _actif THEN 'role.grant' ELSE 'role.revoke' END,
    _target_user_id,
    jsonb_build_object('role', _role::text, 'previous_actif', v_prev_actif)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.super_admin_set_role(uuid, app_role, boolean) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_set_role(uuid, app_role, boolean) TO authenticated;