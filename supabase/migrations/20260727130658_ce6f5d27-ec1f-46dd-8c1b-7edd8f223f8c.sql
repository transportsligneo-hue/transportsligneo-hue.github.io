
-- 1. devis_acceptations: force server-side amount/version from the referenced devis
CREATE OR REPLACE FUNCTION public.devis_acceptations_enforce_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
BEGIN
  -- Admins bypass (they can set explicit values, e.g. corrections)
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  SELECT id, version, prix_estime, user_id, email
    INTO d
  FROM public.devis
  WHERE id = NEW.devis_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Devis introuvable';
  END IF;

  -- Snap the legally-binding fields to the current devis state; ignore client-supplied values
  NEW.montant_accepte := d.prix_estime;
  NEW.devis_version := COALESCE(d.version, 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devis_acceptations_enforce_amount ON public.devis_acceptations;
CREATE TRIGGER trg_devis_acceptations_enforce_amount
BEFORE INSERT OR UPDATE OF montant_accepte, devis_version ON public.devis_acceptations
FOR EACH ROW EXECUTE FUNCTION public.devis_acceptations_enforce_amount();

-- 2. Formation attempts: remove direct client INSERT paths.
--    Grading happens exclusively via SECURITY DEFINER functions
--    (submit_module_quiz, submit_formation_exam).
DROP POLICY IF EXISTS "Convoyeurs create own quiz attempts" ON public.formation_quiz_attempts;
DROP POLICY IF EXISTS "Convoyeurs create own exam attempts" ON public.formation_exam_attempts;
