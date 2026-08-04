CREATE OR REPLACE FUNCTION public.protect_convoyeur_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin')
     OR auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;
  NEW.statut := OLD.statut;
  NEW.account_status := OLD.account_status;
  NEW.training_status := OLD.training_status;
  NEW.has_completed_training := OLD.has_completed_training;
  NEW.training_completed_at := OLD.training_completed_at;
  NEW.user_id := OLD.user_id;
  NEW.organization_id := OLD.organization_id;
  NEW.type_convoyeur := OLD.type_convoyeur;
  RETURN NEW;
END;
$function$;

UPDATE public.convoyeurs c
   SET statut = 'en_attente', updated_at = now()
 WHERE c.statut = 'refuse'
   AND EXISTS (
     SELECT 1 FROM public.convoyeur_invitations i
      WHERE i.convoyeur_id = c.id AND i.status = 'pending' AND i.expires_at > now()
   );