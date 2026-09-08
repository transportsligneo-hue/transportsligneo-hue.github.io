-- 1) Drapeau mission
ALTER TABLE public.trajets
  ADD COLUMN IF NOT EXISTS process_client_externe_requis boolean NOT NULL DEFAULT false;

-- 2) Référentiel des outils externes client
CREATE TABLE IF NOT EXISTS public.outils_externes_client (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  logo_url text,
  type text NOT NULL DEFAULT 'web' CHECK (type IN ('web', 'app')),
  url_web text,
  deeplink text,
  android_package text,
  play_store_url text,
  app_store_url text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  client_nom text,
  instructions text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.outils_externes_client TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.outils_externes_client TO authenticated;
GRANT ALL ON public.outils_externes_client TO service_role;
ALTER TABLE public.outils_externes_client ENABLE ROW LEVEL SECURITY;

CREATE POLICY outils_externes_admin_all ON public.outils_externes_client
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY outils_externes_read ON public.outils_externes_client
  FOR SELECT TO authenticated
  USING (actif = true);

CREATE INDEX IF NOT EXISTS idx_outils_externes_org ON public.outils_externes_client(organization_id);
CREATE INDEX IF NOT EXISTS idx_outils_externes_user ON public.outils_externes_client(user_id);

CREATE TRIGGER trg_outils_externes_updated_at
  BEFORE UPDATE ON public.outils_externes_client
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Preuve de passage par l'outil externe
CREATE TABLE IF NOT EXISTS public.mission_edl_externe_passages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL REFERENCES public.attributions(id) ON DELETE CASCADE,
  outil_id uuid REFERENCES public.outils_externes_client(id) ON DELETE SET NULL,
  outil_nom text,
  type text NOT NULL DEFAULT 'arrivee' CHECK (type IN ('depart', 'arrivee')),
  ouvert_at timestamptz,
  termine_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attribution_id, type)
);

GRANT SELECT, INSERT, UPDATE ON public.mission_edl_externe_passages TO authenticated;
GRANT ALL ON public.mission_edl_externe_passages TO service_role;
ALTER TABLE public.mission_edl_externe_passages ENABLE ROW LEVEL SECURITY;

CREATE POLICY edl_externe_admin_all ON public.mission_edl_externe_passages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY edl_externe_convoyeur_select ON public.mission_edl_externe_passages
  FOR SELECT TO authenticated
  USING (attribution_id IN (
    SELECT a.id FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
  ));

CREATE POLICY edl_externe_convoyeur_insert ON public.mission_edl_externe_passages
  FOR INSERT TO authenticated
  WITH CHECK (attribution_id IN (
    SELECT a.id FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
  ));

CREATE POLICY edl_externe_convoyeur_update ON public.mission_edl_externe_passages
  FOR UPDATE TO authenticated
  USING (attribution_id IN (
    SELECT a.id FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
  ))
  WITH CHECK (attribution_id IN (
    SELECT a.id FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
  ));

CREATE POLICY edl_externe_client_select ON public.mission_edl_externe_passages
  FOR SELECT TO authenticated
  USING (public.is_attribution_client(auth.uid(), attribution_id));

CREATE TRIGGER trg_edl_externe_updated_at
  BEFORE UPDATE ON public.mission_edl_externe_passages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Détection automatique de l'outil externe pour une mission
CREATE OR REPLACE FUNCTION public.get_outil_externe_mission(p_attribution_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
  v_trajet public.trajets%ROWTYPE;
  v_user_id uuid;
  v_org_id uuid;
  v_outil public.outils_externes_client%ROWTYPE;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.attributions a
    LEFT JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE a.id = p_attribution_id
      AND (c.user_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role))
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('requis', false, 'outil', NULL);
  END IF;

  SELECT t.* INTO v_trajet
  FROM public.trajets t
  JOIN public.attributions a ON a.trajet_id = t.id
  WHERE a.id = p_attribution_id;

  IF v_trajet.id IS NULL OR COALESCE(v_trajet.process_client_externe_requis, false) = false THEN
    RETURN jsonb_build_object('requis', false, 'outil', NULL);
  END IF;

  SELECT d.user_id INTO v_user_id
  FROM public.demandes_convoyage d WHERE d.id = v_trajet.demande_id;

  IF v_user_id IS NULL THEN
    SELECT dv.user_id INTO v_user_id
    FROM public.devis dv WHERE dv.id = v_trajet.devis_id;
  END IF;

  SELECT COALESCE(m.organization_id, m.fleet_organization_id) INTO v_org_id
  FROM public.missions m
  WHERE m.trajet_id = v_trajet.id
  LIMIT 1;

  SELECT o.* INTO v_outil
  FROM public.outils_externes_client o
  WHERE o.actif = true
    AND (
      (v_org_id IS NOT NULL AND o.organization_id = v_org_id)
      OR (v_user_id IS NOT NULL AND o.user_id = v_user_id)
      OR (o.client_nom IS NOT NULL AND v_trajet.client_nom IS NOT NULL
          AND lower(btrim(o.client_nom)) = lower(btrim(v_trajet.client_nom)))
    )
  ORDER BY
    (o.organization_id IS NOT NULL AND o.organization_id = v_org_id) DESC,
    (o.user_id IS NOT NULL AND o.user_id = v_user_id) DESC,
    o.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'requis', true,
    'client_nom', v_trajet.client_nom,
    'outil', CASE WHEN v_outil.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_outil.id,
      'nom', v_outil.nom,
      'logo_url', v_outil.logo_url,
      'type', v_outil.type,
      'url_web', v_outil.url_web,
      'deeplink', v_outil.deeplink,
      'android_package', v_outil.android_package,
      'play_store_url', v_outil.play_store_url,
      'app_store_url', v_outil.app_store_url,
      'instructions', v_outil.instructions
    ) END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_outil_externe_mission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_outil_externe_mission(uuid) TO authenticated;