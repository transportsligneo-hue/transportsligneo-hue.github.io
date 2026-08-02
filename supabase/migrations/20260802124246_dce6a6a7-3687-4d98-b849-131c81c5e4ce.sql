
-- 1) missions: add explicit WITH CHECK on client self-update policy
DROP POLICY IF EXISTS "Users can update own missions" ON public.missions;
CREATE POLICY "Users can update own missions"
ON public.missions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2) demandes_convoyage: keep client updates confined to unpaid requests
DROP POLICY IF EXISTS "Authenticated users update own pending demandes" ON public.demandes_convoyage;
CREATE POLICY "Authenticated users update own pending demandes"
ON public.demandes_convoyage
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND payment_status = 'pending')
WITH CHECK (user_id = auth.uid() AND payment_status = 'pending');

-- 3) convoyeurs: explicit policy scoping (column locking handled by trigger below)
DROP POLICY IF EXISTS "Convoyeurs can update own record" ON public.convoyeurs;
CREATE POLICY "Convoyeurs can update own record"
ON public.convoyeurs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4) Reinforce column-lock triggers (idempotent redefinition)
CREATE OR REPLACE FUNCTION public.convoyeurs_protect_privileged_fields()
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
  NEW.statut                 := OLD.statut;
  NEW.account_status         := OLD.account_status;
  NEW.type_convoyeur         := OLD.type_convoyeur;
  NEW.user_id                := OLD.user_id;
  NEW.email                  := OLD.email;
  NEW.training_status        := OLD.training_status;
  NEW.has_completed_training := OLD.has_completed_training;
  NEW.training_completed_at  := OLD.training_completed_at;
  NEW.organization_id        := OLD.organization_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS convoyeurs_protect_privileged_fields_trg ON public.convoyeurs;
CREATE TRIGGER convoyeurs_protect_privileged_fields_trg
BEFORE UPDATE ON public.convoyeurs
FOR EACH ROW EXECUTE FUNCTION public.convoyeurs_protect_privileged_fields();

CREATE OR REPLACE FUNCTION public.demandes_protect_payment_fields()
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
  NEW.payment_status           := OLD.payment_status;
  NEW.amount_paid_cents        := OLD.amount_paid_cents;
  NEW.paid_at                  := OLD.paid_at;
  NEW.prix_estime              := OLD.prix_estime;
  NEW.distance_km              := OLD.distance_km;
  NEW.stripe_session_id        := OLD.stripe_session_id;
  NEW.stripe_payment_intent_id := OLD.stripe_payment_intent_id;
  NEW.devis_id                 := OLD.devis_id;
  NEW.user_id                  := OLD.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS demandes_protect_payment_fields_trg ON public.demandes_convoyage;
CREATE TRIGGER demandes_protect_payment_fields_trg
BEFORE UPDATE ON public.demandes_convoyage
FOR EACH ROW EXECUTE FUNCTION public.demandes_protect_payment_fields();

DROP TRIGGER IF EXISTS missions_protect_operational_fields_trg ON public.missions;
CREATE TRIGGER missions_protect_operational_fields_trg
BEFORE UPDATE ON public.missions
FOR EACH ROW EXECUTE FUNCTION public.missions_protect_operational_fields();
