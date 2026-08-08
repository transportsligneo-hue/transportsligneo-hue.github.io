ALTER TABLE public.convoyeur_contrats
  ADD COLUMN IF NOT EXISTS charte_document_id text,
  ADD COLUMN IF NOT EXISTS charte_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS charte_signed_pdf_path text,
  ADD COLUMN IF NOT EXISTS charte_incluse boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.convoyeur_documents_signes(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT c.statut = 'signe'
         AND (c.charte_incluse = false OR c.charte_signed_at IS NOT NULL)
      FROM public.convoyeur_contrats c
      WHERE c.user_id = _user_id
      ORDER BY c.created_at DESC
      LIMIT 1
    ),
    true
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_convoyeur_docs_signes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.is_privileged_writer()
     AND NOT public.convoyeur_documents_signes(auth.uid()) THEN
    RAISE EXCEPTION 'Vous devez signer votre contrat de partenariat et la charte de presentation et discretion avant d''acceder aux missions.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attributions_docs_signes ON public.attributions;
CREATE TRIGGER trg_attributions_docs_signes
BEFORE INSERT ON public.attributions
FOR EACH ROW EXECUTE FUNCTION public.enforce_convoyeur_docs_signes();

DROP TRIGGER IF EXISTS trg_mission_offres_docs_signes ON public.mission_offres;
CREATE TRIGGER trg_mission_offres_docs_signes
BEFORE INSERT ON public.mission_offres
FOR EACH ROW EXECUTE FUNCTION public.enforce_convoyeur_docs_signes();