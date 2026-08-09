
-- 1) Vue: appliquer les droits de l'appelant
ALTER VIEW public.trajets_publies_safe SET (security_invoker = on);

-- 2) mission_documents: suppression de la policy SELECT trop permissive
DROP POLICY IF EXISTS "Convoyeurs can read own mission documents" ON public.mission_documents;

-- 3) Forcer les drapeaux sur les insertions convoyeur
CREATE OR REPLACE FUNCTION public.mission_documents_force_convoyeur_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM attributions a
    JOIN convoyeurs c ON c.id = a.convoyeur_id
    WHERE a.id = NEW.attribution_id AND c.user_id = auth.uid()
  ) THEN
    NEW.ajoute_par := 'convoyeur';
    NEW.visible_client := false;
    NEW.visible_driver := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mission_documents_force_convoyeur_flags ON public.mission_documents;
CREATE TRIGGER trg_mission_documents_force_convoyeur_flags
BEFORE INSERT ON public.mission_documents
FOR EACH ROW EXECUTE FUNCTION public.mission_documents_force_convoyeur_flags();

-- 4) Policy INSERT convoyeur explicitement restreinte
DROP POLICY IF EXISTS "Convoyeurs can insert own mission documents" ON public.mission_documents;
CREATE POLICY "Convoyeurs can insert own mission documents"
ON public.mission_documents FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND ajoute_par = 'convoyeur'
  AND visible_client = false
  AND attribution_id IN (
    SELECT a.id FROM attributions a
    JOIN convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
  )
);
