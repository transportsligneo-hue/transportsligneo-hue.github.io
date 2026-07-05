
-- Fix privilege escalation: self-referential WITH CHECK compared NEW to NEW.
-- Replace with a BEFORE UPDATE trigger that enforces immutability of privileged
-- fields for non-admins.

CREATE OR REPLACE FUNCTION public.convoyeurs_protect_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Service role and admins bypass restrictions
  IF auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- For self-updates (or any non-admin update), lock privileged fields to OLD values
  NEW.statut          := OLD.statut;
  NEW.account_status  := OLD.account_status;
  NEW.type_convoyeur  := OLD.type_convoyeur;
  NEW.user_id         := OLD.user_id;
  NEW.email           := OLD.email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS convoyeurs_protect_privileged_fields_trg ON public.convoyeurs;
CREATE TRIGGER convoyeurs_protect_privileged_fields_trg
BEFORE UPDATE ON public.convoyeurs
FOR EACH ROW
EXECUTE FUNCTION public.convoyeurs_protect_privileged_fields();

-- Simplify the RLS policy now that the trigger enforces immutability
DROP POLICY IF EXISTS "Convoyeurs can update own record (no privilege fields)" ON public.convoyeurs;
CREATE POLICY "Convoyeurs can update own record"
ON public.convoyeurs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
