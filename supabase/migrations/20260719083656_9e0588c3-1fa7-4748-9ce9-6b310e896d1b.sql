
-- === 1. Convoyeurs : policy simplifiée (triggers existants protègent statut/account_status) ===
DROP POLICY IF EXISTS "Convoyeurs can update own record" ON public.convoyeurs;
CREATE POLICY "Convoyeurs can update own record"
  ON public.convoyeurs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- === 2. Mission offres : policy simplifiée + trigger étendu aux champs admin_counter_* ===
DROP POLICY IF EXISTS "Convoyeurs can update own pending offres" ON public.mission_offres;
CREATE POLICY "Convoyeurs can update own pending offres"
  ON public.mission_offres FOR UPDATE TO authenticated
  USING (
    statut = 'en_attente'
    AND convoyeur_id IN (SELECT id FROM public.convoyeurs WHERE user_id = auth.uid())
  )
  WITH CHECK (
    statut = 'en_attente'
    AND convoyeur_id IN (SELECT id FROM public.convoyeurs WHERE user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.protect_mission_offre_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.is_winning IS DISTINCT FROM OLD.is_winning THEN
    RAISE EXCEPTION 'Seul un administrateur peut désigner l''offre gagnante';
  END IF;
  IF NEW.admin_counter_offer IS DISTINCT FROM OLD.admin_counter_offer THEN
    RAISE EXCEPTION 'Seul un administrateur peut modifier la contre-offre admin';
  END IF;
  IF NEW.admin_counter_by IS DISTINCT FROM OLD.admin_counter_by THEN
    RAISE EXCEPTION 'Seul un administrateur peut modifier la contre-offre admin';
  END IF;

  RETURN NEW;
END;
$function$;

-- === 3. Fonctions publiques : passer en SECURITY INVOKER + policies TO anon ===

-- vat_rates
CREATE OR REPLACE FUNCTION public.get_active_vat_rates()
RETURNS TABLE(id uuid, rate numeric, label text, is_default boolean, is_active boolean, sort_order integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $function$
  SELECT v.id, v.rate, v.label, v.is_default, v.is_active, v.sort_order
  FROM public.vat_rates v
  WHERE v.is_active = true
  ORDER BY v.sort_order NULLS LAST, v.rate;
$function$;

DROP POLICY IF EXISTS "Public reads active vat rates" ON public.vat_rates;
CREATE POLICY "Public reads active vat rates"
  ON public.vat_rates FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- pricing_settings (singleton public info)
CREATE OR REPLACE FUNCTION public.get_public_pricing_display()
RETURNS TABLE(regime text, default_vat_rate numeric, currency text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $function$
  SELECT regime, default_vat_rate, currency
  FROM public.pricing_settings
  WHERE id = true
  LIMIT 1;
$function$;

DROP POLICY IF EXISTS "Public reads pricing display" ON public.pricing_settings;
CREATE POLICY "Public reads pricing display"
  ON public.pricing_settings FOR SELECT TO anon, authenticated
  USING (id = true);

-- ai_settings (public toggles only, singleton)
CREATE OR REPLACE FUNCTION public.get_ai_settings()
RETURNS public.ai_settings
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $function$
  SELECT * FROM public.ai_settings ORDER BY created_at ASC LIMIT 1;
$function$;

DROP POLICY IF EXISTS "Public reads ai_settings" ON public.ai_settings;
CREATE POLICY "Public reads ai_settings"
  ON public.ai_settings FOR SELECT TO anon
  USING (true);

-- scan handoff token resolution (anon uploads document via /scan/:token)
CREATE OR REPLACE FUNCTION public.resolve_scan_handoff_token(_token text)
RETURNS TABLE(session_id uuid, context text, expires_at timestamptz, status text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT s.id, s.context, s.expires_at, s.status
    FROM public.scan_handoff_sessions s
   WHERE s.token = _token
     AND s.expires_at > now()
   LIMIT 1;
END;
$function$;

DROP POLICY IF EXISTS "Public resolves live scan handoff sessions" ON public.scan_handoff_sessions;
CREATE POLICY "Public resolves live scan handoff sessions"
  ON public.scan_handoff_sessions FOR SELECT TO anon, authenticated
  USING (expires_at > now());

-- === 4. Vue trajets_publies_safe : convertir en security_invoker=on ===
-- Backing SECURITY DEFINER function retourne uniquement les colonnes safe
-- (aucune PII client) et n'est exécutable que par les rôles authentifiés.
CREATE OR REPLACE FUNCTION public._trajets_publies_safe_rows()
RETURNS TABLE(
  id uuid,
  depart text,
  arrivee text,
  date_trajet date,
  heure_trajet text,
  marque text,
  modele text,
  prix_suggere numeric,
  prix_convoyeur numeric,
  prix_convoyeur_fixe numeric,
  prix_convoyeur_min numeric,
  prix_convoyeur_max numeric,
  pricing_mode text,
  attribution_mode text,
  allow_counter_offer boolean,
  proposal_expires_at timestamptz,
  statut_publication text,
  published_at timestamptz,
  created_at timestamptz,
  mission_group_id uuid,
  leg_type text,
  bidding_enabled boolean,
  is_test_data boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    t.id, t.depart, t.arrivee, t.date_trajet, t.heure_trajet,
    t.marque, t.modele, t.prix_suggere, t.prix_convoyeur,
    t.prix_convoyeur_fixe, t.prix_convoyeur_min, t.prix_convoyeur_max,
    t.pricing_mode, t.attribution_mode, t.allow_counter_offer,
    t.proposal_expires_at, t.statut_publication, t.published_at,
    t.created_at, t.mission_group_id, t.leg_type,
    COALESCE(t.bidding_enabled, false),
    COALESCE(t.is_test_data, false)
  FROM public.trajets t
  WHERE t.statut_publication = 'publie'
    AND t.attribution_mode IN ('catalogue', 'mixte')
    AND (t.proposal_expires_at IS NULL OR t.proposal_expires_at > now())
    AND public.is_validated_convoyeur(auth.uid());
$function$;

REVOKE ALL ON FUNCTION public._trajets_publies_safe_rows() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._trajets_publies_safe_rows() FROM anon;
GRANT EXECUTE ON FUNCTION public._trajets_publies_safe_rows() TO authenticated, service_role;

DROP VIEW IF EXISTS public.trajets_publies_safe;
CREATE VIEW public.trajets_publies_safe
  WITH (security_invoker = on) AS
  SELECT * FROM public._trajets_publies_safe_rows();

GRANT SELECT ON public.trajets_publies_safe TO authenticated;
