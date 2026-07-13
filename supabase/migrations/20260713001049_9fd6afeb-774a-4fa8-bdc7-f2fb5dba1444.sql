CREATE OR REPLACE FUNCTION public.admin_publish_to_catalogue(
  _trajet_id uuid,
  _allow_counter_offer boolean DEFAULT true,
  _expires_in_hours integer DEFAULT 168
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_role(v_uid, 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.attributions
    WHERE trajet_id = _trajet_id
      AND statut IN ('accepte', 'en_cours', 'en_attente_validation', 'validee', 'termine')
  ) THEN
    RAISE EXCEPTION 'Cette mission a déjà une attribution active ou terminée';
  END IF;

  -- Si une proposition directe était en attente, la publication catalogue la libère.
  UPDATE public.attributions
     SET statut = 'annule',
         etape_courante = NULL
   WHERE trajet_id = _trajet_id
     AND statut IN ('propose', 'refusee', 'refuse');

  UPDATE public.trajets
     SET attribution_mode = 'catalogue',
         allow_counter_offer = COALESCE(_allow_counter_offer, true),
         statut_publication = 'publie',
         statut = CASE
           WHEN statut IN ('attribue', 'accepte', 'en_cours', 'termine', 'annule') THEN statut
           ELSE 'en_attente'
         END,
         proposal_expires_at = now() + make_interval(hours => COALESCE(_expires_in_hours, 168)),
         published_at = now(),
         updated_at = now()
   WHERE id = _trajet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trajet introuvable';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_publish_to_catalogue(uuid, boolean, integer) TO authenticated;

DROP POLICY IF EXISTS "Validated convoyeurs can read published catalogue trajets" ON public.trajets;
CREATE POLICY "Validated convoyeurs can read published catalogue trajets"
ON public.trajets
FOR SELECT
TO authenticated
USING (
  statut_publication = 'publie'
  AND attribution_mode IN ('catalogue', 'mixte')
  AND (proposal_expires_at IS NULL OR proposal_expires_at > now())
  AND public.is_validated_convoyeur(auth.uid())
);