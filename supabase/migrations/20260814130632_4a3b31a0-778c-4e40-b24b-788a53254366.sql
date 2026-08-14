
-- 1. convoyeurs: trigger-based protection of privileged fields
CREATE OR REPLACE FUNCTION public.guard_convoyeurs_protected_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin'::app_role)
     OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.statut := OLD.statut;
  NEW.account_status := OLD.account_status;
  NEW.has_completed_training := OLD.has_completed_training;
  NEW.training_status := OLD.training_status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_convoyeurs_protected_fields ON public.convoyeurs;
CREATE TRIGGER trg_guard_convoyeurs_protected_fields
BEFORE UPDATE ON public.convoyeurs
FOR EACH ROW EXECUTE FUNCTION public.guard_convoyeurs_protected_fields();

DROP POLICY IF EXISTS "Convoyeurs can update own record" ON public.convoyeurs;
CREATE POLICY "Convoyeurs can update own record"
ON public.convoyeurs FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. demandes_convoyage: protect pricing fields
CREATE OR REPLACE FUNCTION public.guard_demandes_price_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin'::app_role)
     OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.prix_estime := OLD.prix_estime;
  NEW.distance_km := OLD.distance_km;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_demandes_price_fields ON public.demandes_convoyage;
CREATE TRIGGER trg_guard_demandes_price_fields
BEFORE UPDATE ON public.demandes_convoyage
FOR EACH ROW EXECUTE FUNCTION public.guard_demandes_price_fields();

DROP POLICY IF EXISTS "Authenticated users update own pending demandes" ON public.demandes_convoyage;
CREATE POLICY "Authenticated users update own pending demandes"
ON public.demandes_convoyage FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND payment_status = 'pending')
WITH CHECK (user_id = auth.uid() AND payment_status = 'pending');

-- 3. profiles: protect privilege fields
CREATE OR REPLACE FUNCTION public.guard_profiles_protected_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin'::app_role)
     OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.organization_id := OLD.organization_id;
  NEW.type_client := OLD.type_client;
  NEW.account_status := OLD.account_status;
  NEW.exempte_acceptation_devis := OLD.exempte_acceptation_devis;
  NEW.relances_disabled := OLD.relances_disabled;
  NEW.pricing_display_mode := OLD.pricing_display_mode;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profiles_protected_fields ON public.profiles;
CREATE TRIGGER trg_guard_profiles_protected_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_protected_fields();

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
