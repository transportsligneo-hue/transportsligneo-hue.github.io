-- 1. Validate notification links (relative paths only)
CREATE OR REPLACE FUNCTION public.create_admin_notification(
  _type text,
  _titre text,
  _message text DEFAULT NULL::text,
  _link text DEFAULT NULL::text,
  _entity_type text DEFAULT NULL::text,
  _entity_id uuid DEFAULT NULL::uuid,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_allowed text[] := ARRAY[
    'incident','estimation','devis','mission_acceptee','mission_offre',
    'mission_terminee','client_action','driver_action','b2b_lead','b2b_paiement'
  ];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT (_type = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'Invalid notification type';
  END IF;
  IF _titre IS NULL OR length(trim(_titre)) = 0 OR length(_titre) > 300 THEN
    RAISE EXCEPTION 'Invalid title';
  END IF;
  IF _message IS NOT NULL AND length(_message) > 2000 THEN
    RAISE EXCEPTION 'Message too long';
  END IF;
  IF _link IS NOT NULL THEN
    IF length(_link) > 500 THEN
      RAISE EXCEPTION 'Link too long';
    END IF;
    IF _link !~ '^/' THEN
      RAISE EXCEPTION 'Link must be a relative path starting with /';
    END IF;
  END IF;

  INSERT INTO public.admin_notifications (type, titre, message, link, entity_type, entity_id, metadata)
  VALUES (_type, trim(_titre), _message, _link, _entity_type, _entity_id, coalesce(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- 2. Tighten mission_offres UPDATE policy
DROP POLICY IF EXISTS "Convoyeurs can update own pending offres" ON public.mission_offres;

CREATE POLICY "Convoyeurs can update own pending offres"
ON public.mission_offres
FOR UPDATE
TO authenticated
USING (
  statut = 'en_attente'
  AND convoyeur_id IN (
    SELECT convoyeurs.id FROM public.convoyeurs WHERE convoyeurs.user_id = auth.uid()
  )
)
WITH CHECK (
  statut = 'en_attente'
  AND convoyeur_id IN (
    SELECT convoyeurs.id FROM public.convoyeurs WHERE convoyeurs.user_id = auth.uid()
  )
);

-- 3. Tighten convoyeur-permis storage upload
DROP POLICY IF EXISTS "Convoyeurs upload own permis" ON storage.objects;

CREATE POLICY "Convoyeurs upload own permis"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'convoyeur-permis'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.convoyeurs WHERE user_id = auth.uid()
  )
);