-- Helper: privileged writer check
CREATE OR REPLACE FUNCTION public.is_privileged_writer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.role() = 'service_role'
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
$$;

-- 1. demandes_convoyage : forbid forged payment/ownership on INSERT
CREATE OR REPLACE FUNCTION public.demandes_protect_insert_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_privileged_writer() THEN
    RETURN NEW;
  END IF;
  NEW.user_id                  := auth.uid();
  NEW.payment_status           := 'pending';
  NEW.amount_paid_cents        := NULL;
  NEW.paid_at                  := NULL;
  NEW.stripe_session_id        := NULL;
  NEW.stripe_payment_intent_id := NULL;
  NEW.statut                   := 'nouvelle';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS demandes_protect_insert_fields_trg ON public.demandes_convoyage;
CREATE TRIGGER demandes_protect_insert_fields_trg
BEFORE INSERT ON public.demandes_convoyage
FOR EACH ROW EXECUTE FUNCTION public.demandes_protect_insert_fields();

-- 2. devis : forbid forged paid/accepted quotes on INSERT
CREATE OR REPLACE FUNCTION public.devis_protect_insert_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_privileged_writer() THEN
    RETURN NEW;
  END IF;
  NEW.user_id                  := auth.uid();
  NEW.statut                   := 'envoye';
  NEW.paid_at                  := NULL;
  NEW.amount_paid_cents        := NULL;
  NEW.stripe_session_id        := NULL;
  NEW.stripe_payment_intent_id := NULL;
  NEW.accepted_at              := NULL;
  NEW.converted_at             := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS devis_protect_insert_fields_trg ON public.devis;
CREATE TRIGGER devis_protect_insert_fields_trg
BEFORE INSERT ON public.devis
FOR EACH ROW EXECUTE FUNCTION public.devis_protect_insert_fields();

-- 3. b2b_transport_requests : anonymous submissions cannot forge payment/assignment
CREATE OR REPLACE FUNCTION public.b2b_transport_protect_insert_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_privileged_writer() THEN
    RETURN NEW;
  END IF;

  NEW.payment_status           := 'pending';
  NEW.operational_status       := 'nouveau';
  NEW.assigned_convoyeur_id    := NULL;
  NEW.stripe_session_id        := NULL;
  NEW.stripe_payment_intent_id := NULL;

  IF auth.uid() IS NULL THEN
    -- Anonymous public form: no company/org attribution allowed
    NEW.company_id      := NULL;
    NEW.organization_id := NULL;
  ELSE
    IF NEW.organization_id IS NOT NULL
       AND NOT public.is_org_member(NEW.organization_id, auth.uid()) THEN
      NEW.organization_id := NULL;
    END IF;
    IF NEW.company_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.companies c
         WHERE c.id = NEW.company_id
           AND lower(c.contact_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
       ) THEN
      NEW.company_id := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS b2b_transport_protect_insert_fields_trg ON public.b2b_transport_requests;
CREATE TRIGGER b2b_transport_protect_insert_fields_trg
BEFORE INSERT ON public.b2b_transport_requests
FOR EACH ROW EXECUTE FUNCTION public.b2b_transport_protect_insert_fields();

-- 4. mission_offres : convoyeurs cannot self-declare winning bids or fake admin counter-offers
CREATE OR REPLACE FUNCTION public.mission_offres_protect_insert_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_privileged_writer() THEN
    RETURN NEW;
  END IF;
  NEW.is_winning          := false;
  NEW.admin_counter_offer := NULL;
  NEW.admin_counter_at    := NULL;
  NEW.admin_counter_by    := NULL;
  NEW.statut              := 'en_attente';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mission_offres_protect_insert_fields_trg ON public.mission_offres;
CREATE TRIGGER mission_offres_protect_insert_fields_trg
BEFORE INSERT ON public.mission_offres
FOR EACH ROW EXECUTE FUNCTION public.mission_offres_protect_insert_fields();