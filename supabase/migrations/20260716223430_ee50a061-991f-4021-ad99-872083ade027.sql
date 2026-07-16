
-- 1) convoyeurs: expand privileged-field lockdown to include training/validation flags
CREATE OR REPLACE FUNCTION public.convoyeurs_protect_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  NEW.statut                  := OLD.statut;
  NEW.account_status          := OLD.account_status;
  NEW.type_convoyeur          := OLD.type_convoyeur;
  NEW.user_id                 := OLD.user_id;
  NEW.email                   := OLD.email;
  NEW.training_status         := OLD.training_status;
  NEW.has_completed_training  := OLD.has_completed_training;
  RETURN NEW;
END;
$function$;

-- 2) demandes_convoyage: block clients from editing payment / pricing / Stripe fields
CREATE OR REPLACE FUNCTION public.demandes_protect_payment_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  NEW.payment_status       := OLD.payment_status;
  NEW.amount_paid_cents    := OLD.amount_paid_cents;
  NEW.paid_at              := OLD.paid_at;
  NEW.prix_estime          := OLD.prix_estime;
  NEW.stripe_session_id    := OLD.stripe_session_id;
  NEW.stripe_payment_intent_id := OLD.stripe_payment_intent_id;
  NEW.user_id              := OLD.user_id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS demandes_protect_payment_fields_trg ON public.demandes_convoyage;
CREATE TRIGGER demandes_protect_payment_fields_trg
BEFORE UPDATE ON public.demandes_convoyage
FOR EACH ROW EXECUTE FUNCTION public.demandes_protect_payment_fields();

-- 3) missions: block clients from editing price / status / operational fields
CREATE OR REPLACE FUNCTION public.missions_protect_operational_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  NEW.prix_total           := OLD.prix_total;
  NEW.prix_locked          := OLD.prix_locked;
  NEW.statut               := OLD.statut;
  NEW.numero               := OLD.numero;
  NEW.user_id              := OLD.user_id;
  NEW.organization_id      := OLD.organization_id;
  NEW.fleet_organization_id := OLD.fleet_organization_id;
  NEW.mission_group_id     := OLD.mission_group_id;
  NEW.leg_type             := OLD.leg_type;
  NEW.leg_index            := OLD.leg_index;
  NEW.archived_at          := OLD.archived_at;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS missions_protect_operational_fields_trg ON public.missions;
CREATE TRIGGER missions_protect_operational_fields_trg
BEFORE UPDATE ON public.missions
FOR EACH ROW EXECUTE FUNCTION public.missions_protect_operational_fields();

-- 4) Convert trajets_publies_safe to SECURITY INVOKER + add supporting RLS policy
ALTER VIEW public.trajets_publies_safe SET (security_invoker = on);

DROP POLICY IF EXISTS "Validated convoyeurs read catalogue trajets" ON public.trajets;
CREATE POLICY "Validated convoyeurs read catalogue trajets"
ON public.trajets
FOR SELECT
TO authenticated
USING (
  statut_publication = 'publie'
  AND attribution_mode = ANY (ARRAY['catalogue'::text, 'mixte'::text])
  AND (proposal_expires_at IS NULL OR proposal_expires_at > now())
  AND COALESCE(is_test_data, false) = false
  AND public.is_validated_convoyeur(auth.uid())
);
