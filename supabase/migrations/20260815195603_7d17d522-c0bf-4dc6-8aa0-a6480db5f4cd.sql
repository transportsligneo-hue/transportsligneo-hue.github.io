
-- 1) Convoyeurs : refuser explicitement toute tentative de modification des champs privilégiés
CREATE OR REPLACE FUNCTION public.convoyeurs_protect_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin')
     OR auth.role() = 'service_role'
     OR auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.statut IS DISTINCT FROM OLD.statut
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.type_convoyeur IS DISTINCT FROM OLD.type_convoyeur
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.training_status IS DISTINCT FROM OLD.training_status
     OR NEW.has_completed_training IS DISTINCT FROM OLD.has_completed_training
     OR NEW.training_completed_at IS DISTINCT FROM OLD.training_completed_at
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.niveau IS DISTINCT FROM OLD.niveau
     OR NEW.missions_terminees IS DISTINCT FROM OLD.missions_terminees
     OR NEW.note_moyenne IS DISTINCT FROM OLD.note_moyenne THEN
    RAISE EXCEPTION 'Modification non autorisée : champs réservés à l''administration';
  END IF;

  RETURN NEW;
END;
$function$;

-- Supprime les triggers redondants (remplacés par le trigger unique ci-dessus)
DROP TRIGGER IF EXISTS trg_guard_convoyeurs_protected_fields ON public.convoyeurs;
DROP TRIGGER IF EXISTS trg_protect_convoyeur_sensitive ON public.convoyeurs;
DROP FUNCTION IF EXISTS public.guard_convoyeurs_protected_fields();
DROP FUNCTION IF EXISTS public.protect_convoyeur_sensitive_fields();

DROP TRIGGER IF EXISTS convoyeurs_protect_privileged_fields_trg ON public.convoyeurs;
CREATE TRIGGER convoyeurs_protect_privileged_fields_trg
BEFORE UPDATE ON public.convoyeurs
FOR EACH ROW EXECUTE FUNCTION public.convoyeurs_protect_privileged_fields();

-- 2) Profiles : idem
CREATE OR REPLACE FUNCTION public.profiles_protect_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin')
     OR auth.role() = 'service_role'
     OR auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.type_client IS DISTINCT FROM OLD.type_client
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.statut IS DISTINCT FROM OLD.statut
     OR NEW.exempte_acceptation_devis IS DISTINCT FROM OLD.exempte_acceptation_devis
     OR NEW.relances_disabled IS DISTINCT FROM OLD.relances_disabled
     OR NEW.pricing_display_mode IS DISTINCT FROM OLD.pricing_display_mode
     OR NEW.facture_mention_active IS DISTINCT FROM OLD.facture_mention_active
     OR NEW.facture_mention_legale IS DISTINCT FROM OLD.facture_mention_legale
     OR NEW.tva_exemption_note IS DISTINCT FROM OLD.tva_exemption_note THEN
    RAISE EXCEPTION 'Modification non autorisée : champs réservés à l''administration';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_profiles_protected_fields ON public.profiles;
DROP FUNCTION IF EXISTS public.guard_profiles_protected_fields();

DROP TRIGGER IF EXISTS profiles_protect_privileged_fields_trg ON public.profiles;
CREATE TRIGGER profiles_protect_privileged_fields_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_protect_privileged_fields();
