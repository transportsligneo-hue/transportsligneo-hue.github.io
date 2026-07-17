
-- 1. convoyeurs INSERT: empêcher l'auto-escalation du statut
DROP POLICY IF EXISTS "Users can insert own convoyeur record" ON public.convoyeurs;
CREATE POLICY "Users can insert own convoyeur record"
  ON public.convoyeurs FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (statut IS NULL OR statut = 'en_attente')
    AND (account_status IS NULL OR account_status = 'pending')
  );

-- Empêcher aussi la modification de statut/account_status par le convoyeur lui-même
DROP POLICY IF EXISTS "Convoyeurs can update own record" ON public.convoyeurs;
CREATE POLICY "Convoyeurs can update own record"
  ON public.convoyeurs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND statut = (SELECT c.statut FROM public.convoyeurs c WHERE c.id = convoyeurs.id)
    AND account_status IS NOT DISTINCT FROM (SELECT c.account_status FROM public.convoyeurs c WHERE c.id = convoyeurs.id)
  );

-- 2. mission_offres UPDATE: empêcher la modification des champs contre-offre admin
DROP POLICY IF EXISTS "Convoyeurs can update own pending offres" ON public.mission_offres;
CREATE POLICY "Convoyeurs can update own pending offres"
  ON public.mission_offres FOR UPDATE TO authenticated
  USING (
    statut = 'en_attente'
    AND convoyeur_id IN (
      SELECT id FROM public.convoyeurs WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    statut = 'en_attente'
    AND convoyeur_id IN (
      SELECT id FROM public.convoyeurs WHERE user_id = auth.uid()
    )
    AND admin_counter_offer IS NOT DISTINCT FROM (SELECT o.admin_counter_offer FROM public.mission_offres o WHERE o.id = mission_offres.id)
    AND admin_counter_by IS NOT DISTINCT FROM (SELECT o.admin_counter_by FROM public.mission_offres o WHERE o.id = mission_offres.id)
  );

-- 3. vat_rates: restriction aux admins + RPC publique pour l'affichage
DROP POLICY IF EXISTS "Authenticated users can read vat rates" ON public.vat_rates;

CREATE OR REPLACE FUNCTION public.get_active_vat_rates()
RETURNS TABLE (
  id uuid,
  rate numeric,
  label text,
  is_default boolean,
  is_active boolean,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.rate, v.label, v.is_default, v.is_active, v.sort_order
  FROM public.vat_rates v
  WHERE v.is_active = true
  ORDER BY v.sort_order NULLS LAST, v.rate;
$$;

REVOKE ALL ON FUNCTION public.get_active_vat_rates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_vat_rates() TO anon, authenticated;

-- 4. Retirer l'accès anon aux RPC handoff (appelées via service role dans l'API publique)
REVOKE EXECUTE ON FUNCTION public.resolve_scan_handoff_token(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.push_scan_handoff_extraction(text, jsonb) FROM anon, public;
