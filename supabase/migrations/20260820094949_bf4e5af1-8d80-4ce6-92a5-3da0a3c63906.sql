CREATE OR REPLACE FUNCTION public.missions_protect_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins et super admins peuvent tout modifier
  IF has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Appels serveur sans session utilisateur (service_role / triggers internes)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.prix_total IS DISTINCT FROM OLD.prix_total THEN
    RAISE EXCEPTION 'Modification du prix non autorisée';
  END IF;

  IF NEW.statut IS DISTINCT FROM OLD.statut THEN
    RAISE EXCEPTION 'Modification du statut non autorisée';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Modification de l''organisation non autorisée';
  END IF;

  IF NEW.fleet_organization_id IS DISTINCT FROM OLD.fleet_organization_id THEN
    RAISE EXCEPTION 'Modification de la flotte non autorisée';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Modification du propriétaire non autorisée';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS missions_protect_privileged_columns_trg ON public.missions;
CREATE TRIGGER missions_protect_privileged_columns_trg
BEFORE UPDATE ON public.missions
FOR EACH ROW
EXECUTE FUNCTION public.missions_protect_privileged_columns();

DROP POLICY IF EXISTS "Users can update own missions" ON public.missions;
CREATE POLICY "Users can update own missions"
ON public.missions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);