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

  -- Coordonnées bancaires : saisie initiale autorisée, modification ultérieure réservée à l'admin
  IF (coalesce(OLD.iban, '') <> '' AND NEW.iban IS DISTINCT FROM OLD.iban)
     OR (coalesce(OLD.bic, '') <> '' AND NEW.bic IS DISTINCT FROM OLD.bic)
     OR (coalesce(OLD.titulaire_compte, '') <> '' AND NEW.titulaire_compte IS DISTINCT FROM OLD.titulaire_compte) THEN
    RAISE EXCEPTION 'Modification des coordonnées bancaires réservée à l''administration : contactez Transports Ligneo';
  END IF;

  RETURN NEW;
END;
$function$;