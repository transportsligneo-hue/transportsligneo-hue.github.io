
-- 1) Revoke anon EXECUTE on SECURITY DEFINER functions not meant to be public
REVOKE EXECUTE ON FUNCTION public.get_active_vat_rates() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_ai_settings() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_vat_rates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_settings() TO authenticated;

-- 2) Prevent convoyeurs from tampering with admin-only fields on mission_incidents
CREATE OR REPLACE FUNCTION public.prevent_convoyeur_incident_field_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Admins and super_admins bypass this restriction
  IF has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Only the assigned convoyeur may reach this trigger via RLS.
  -- Block changes to admin-managed columns.
  IF NEW.reponse_admin IS DISTINCT FROM OLD.reponse_admin THEN
    RAISE EXCEPTION 'Champ reponse_admin réservé aux administrateurs';
  END IF;
  IF NEW.resolu_at IS DISTINCT FROM OLD.resolu_at THEN
    RAISE EXCEPTION 'Champ resolu_at réservé aux administrateurs';
  END IF;
  IF NEW.gravite IS DISTINCT FROM OLD.gravite THEN
    RAISE EXCEPTION 'Champ gravite réservé aux administrateurs';
  END IF;
  IF NEW.titre IS DISTINCT FROM OLD.titre THEN
    RAISE EXCEPTION 'Champ titre non modifiable après création';
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    RAISE EXCEPTION 'Champ description non modifiable après création';
  END IF;
  IF NEW.statut IS DISTINCT FROM OLD.statut THEN
    RAISE EXCEPTION 'Transition de statut réservée aux administrateurs';
  END IF;
  IF NEW.convoyeur_user_id IS DISTINCT FROM OLD.convoyeur_user_id
     OR NEW.attribution_id IS DISTINCT FROM OLD.attribution_id THEN
    RAISE EXCEPTION 'Relations d''incident non modifiables';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_convoyeur_incident_tampering ON public.mission_incidents;
CREATE TRIGGER trg_prevent_convoyeur_incident_tampering
BEFORE UPDATE ON public.mission_incidents
FOR EACH ROW
EXECUTE FUNCTION public.prevent_convoyeur_incident_field_tampering();
