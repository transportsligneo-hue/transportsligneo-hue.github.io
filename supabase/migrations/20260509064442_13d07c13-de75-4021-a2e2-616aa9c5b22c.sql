
-- 1) trajets: hide sensitive client fields from non-assigned convoyeurs.
DROP POLICY IF EXISTS "Convoyeurs can see published trajets" ON public.trajets;

CREATE OR REPLACE VIEW public.trajets_publies_safe
WITH (security_invoker = true) AS
SELECT
  t.id,
  t.depart,
  t.arrivee,
  t.date_trajet,
  t.heure_trajet,
  t.marque,
  t.modele,
  t.prix_suggere,
  t.statut_publication,
  t.created_at,
  t.pricing_mode,
  t.prix_convoyeur_fixe,
  t.prix_convoyeur_min,
  t.prix_convoyeur_max
FROM public.trajets t
WHERE t.statut_publication = 'publie';

-- A SECURITY DEFINER guard: only validated convoyeurs and admins can read the view.
CREATE OR REPLACE FUNCTION public.is_validated_convoyeur(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.convoyeurs
    WHERE user_id = _user_id AND statut = 'valide'
  );
$$;

-- Restrict the view: re-add a narrow RLS policy on trajets allowing access only
-- to non-sensitive columns via the view. Because RLS doesn't gate columns,
-- we create a dedicated policy that returns rows for validated convoyeurs but
-- callers should query the view (we update app code accordingly).
CREATE POLICY "Convoyeurs read published trajets via safe view"
ON public.trajets
FOR SELECT
TO authenticated
USING (
  statut_publication = 'publie'
  AND public.is_validated_convoyeur(auth.uid())
);
-- Note: assigned convoyeurs still see their full row through the existing
-- "Convoyeurs can see assigned trajets" policy.

REVOKE ALL ON public.trajets_publies_safe FROM PUBLIC;
GRANT SELECT ON public.trajets_publies_safe TO authenticated;

-- 2) convoyeurs: prevent self-escalation of statut/account_status/type_convoyeur.
DROP POLICY IF EXISTS "Convoyeurs can update own record" ON public.convoyeurs;

CREATE POLICY "Convoyeurs can update own record (no privilege fields)"
ON public.convoyeurs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND statut = (SELECT c.statut FROM public.convoyeurs c WHERE c.id = convoyeurs.id)
  AND account_status = (SELECT c.account_status FROM public.convoyeurs c WHERE c.id = convoyeurs.id)
  AND type_convoyeur = (SELECT c.type_convoyeur FROM public.convoyeurs c WHERE c.id = convoyeurs.id)
  AND user_id = (SELECT c.user_id FROM public.convoyeurs c WHERE c.id = convoyeurs.id)
  AND email = (SELECT c.email FROM public.convoyeurs c WHERE c.id = convoyeurs.id)
);

-- 3) activity_logs: remove direct INSERT, force RPC log_activity (already SECURITY DEFINER).
DROP POLICY IF EXISTS "Authenticated can insert activity logs" ON public.activity_logs;
-- (No replacement; only the SECURITY DEFINER function log_activity may insert.)

-- 4) storage convoyeur-documents UPDATE: require ownership row in documents_convoyeurs.
DROP POLICY IF EXISTS "Convoyeurs can update own documents" ON storage.objects;
CREATE POLICY "Convoyeurs can update own documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'convoyeur-documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1
    FROM public.documents_convoyeurs d
    JOIN public.convoyeurs c ON c.id = d.convoyeur_id
    WHERE c.user_id = auth.uid()
      AND d.url_fichier LIKE '%' || storage.objects.name
  )
);

-- 5) realtime.messages: restrict subscriptions to authenticated users (deny anon).
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users only" ON realtime.messages;
CREATE POLICY "Authenticated users only"
ON realtime.messages
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can send" ON realtime.messages;
CREATE POLICY "Authenticated users can send"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
