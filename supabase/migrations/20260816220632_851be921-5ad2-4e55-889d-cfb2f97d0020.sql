-- 1) app_settings : allow-list explicite des clés lisibles par les utilisateurs connectés
CREATE OR REPLACE FUNCTION public.is_public_app_setting_key(_key text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _key IN (
    'factures.auto_relances',
    'factures.auto_retard',
    'facture_mention_default'
  );
$$;

DROP POLICY IF EXISTS "Authenticated can read facture flags" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated can read facture mention" ON public.app_settings;

CREATE POLICY "Authenticated can read allow-listed settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (public.is_public_app_setting_key(key));

-- 2) mission_offres : encadrer la création d'offres (mission ouverte + niveau requis)
CREATE OR REPLACE FUNCTION public.can_convoyeur_bid_on_trajet(_convoyeur_id uuid, _trajet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.convoyeurs c
    JOIN public.trajets t ON t.id = _trajet_id
    WHERE c.id = _convoyeur_id
      AND c.user_id = auth.uid()
      AND c.statut = 'valide'
      AND t.statut_publication = 'publie'
      AND coalesce(t.statut, 'en_attente') NOT IN ('attribue', 'attribuee', 'en_cours', 'termine', 'terminee', 'annule', 'annulee')
      AND public.convoyeur_level_rank(c.niveau) >= public.convoyeur_level_rank(t.niveau_requis)
  );
$$;

REVOKE ALL ON FUNCTION public.can_convoyeur_bid_on_trajet(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_convoyeur_bid_on_trajet(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Convoyeurs can create own offres on published trajets" ON public.mission_offres;

CREATE POLICY "Convoyeurs can create own offres on eligible trajets"
ON public.mission_offres
FOR INSERT
TO authenticated
WITH CHECK (public.can_convoyeur_bid_on_trajet(convoyeur_id, trajet_id));

-- Empêche le spam d'offres en attente sur une même mission
CREATE UNIQUE INDEX IF NOT EXISTS mission_offres_unique_pending
ON public.mission_offres (trajet_id, convoyeur_id)
WHERE statut = 'en_attente';