
-- 1. profiles: protect privileged columns
CREATE OR REPLACE FUNCTION public.profiles_protect_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  NEW.user_id                   := OLD.user_id;
  NEW.organization_id           := OLD.organization_id;
  NEW.type_client               := OLD.type_client;
  NEW.account_status            := OLD.account_status;
  NEW.statut                    := OLD.statut;
  NEW.exempte_acceptation_devis := OLD.exempte_acceptation_devis;
  NEW.relances_disabled         := OLD.relances_disabled;
  NEW.pricing_display_mode      := OLD.pricing_display_mode;
  NEW.facture_mention_active    := OLD.facture_mention_active;
  NEW.facture_mention_legale    := OLD.facture_mention_legale;
  NEW.tva_exemption_note        := OLD.tva_exemption_note;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_privileged_fields_trg ON public.profiles;
CREATE TRIGGER profiles_protect_privileged_fields_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_protect_privileged_fields();

-- 2. Declarative WITH CHECK guards on self-update policies
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      organization_id IS NOT DISTINCT FROM (SELECT p.organization_id FROM public.profiles p WHERE p.id = profiles.id)
      AND type_client IS NOT DISTINCT FROM (SELECT p.type_client FROM public.profiles p WHERE p.id = profiles.id)
      AND account_status IS NOT DISTINCT FROM (SELECT p.account_status FROM public.profiles p WHERE p.id = profiles.id)
      AND exempte_acceptation_devis IS NOT DISTINCT FROM (SELECT p.exempte_acceptation_devis FROM public.profiles p WHERE p.id = profiles.id)
      AND relances_disabled IS NOT DISTINCT FROM (SELECT p.relances_disabled FROM public.profiles p WHERE p.id = profiles.id)
      AND pricing_display_mode IS NOT DISTINCT FROM (SELECT p.pricing_display_mode FROM public.profiles p WHERE p.id = profiles.id)
    )
  )
);

DROP POLICY IF EXISTS "Users can update own missions" ON public.missions;
CREATE POLICY "Users can update own missions"
ON public.missions FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      prix_total IS NOT DISTINCT FROM (SELECT m.prix_total FROM public.missions m WHERE m.id = missions.id)
      AND statut IS NOT DISTINCT FROM (SELECT m.statut FROM public.missions m WHERE m.id = missions.id)
      AND organization_id IS NOT DISTINCT FROM (SELECT m.organization_id FROM public.missions m WHERE m.id = missions.id)
    )
  )
);

DROP POLICY IF EXISTS "Authenticated users update own pending demandes" ON public.demandes_convoyage;
CREATE POLICY "Authenticated users update own pending demandes"
ON public.demandes_convoyage FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND payment_status = 'pending')
WITH CHECK (
  user_id = auth.uid()
  AND payment_status = 'pending'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      prix_estime IS NOT DISTINCT FROM (SELECT d.prix_estime FROM public.demandes_convoyage d WHERE d.id = demandes_convoyage.id)
      AND distance_km IS NOT DISTINCT FROM (SELECT d.distance_km FROM public.demandes_convoyage d WHERE d.id = demandes_convoyage.id)
    )
  )
);

DROP POLICY IF EXISTS "Convoyeurs can update own record" ON public.convoyeurs;
CREATE POLICY "Convoyeurs can update own record"
ON public.convoyeurs FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      statut IS NOT DISTINCT FROM (SELECT c.statut FROM public.convoyeurs c WHERE c.id = convoyeurs.id)
      AND account_status IS NOT DISTINCT FROM (SELECT c.account_status FROM public.convoyeurs c WHERE c.id = convoyeurs.id)
      AND has_completed_training IS NOT DISTINCT FROM (SELECT c.has_completed_training FROM public.convoyeurs c WHERE c.id = convoyeurs.id)
      AND training_status IS NOT DISTINCT FROM (SELECT c.training_status FROM public.convoyeurs c WHERE c.id = convoyeurs.id)
    )
  )
);
