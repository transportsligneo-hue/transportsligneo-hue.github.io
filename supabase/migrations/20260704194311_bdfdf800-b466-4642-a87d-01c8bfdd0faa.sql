
-- ============================================================================
-- SPRINT 1 — Sécurisation RLS (Go-Live)
-- ============================================================================

-- 1) documents_convoyeurs : empêcher un convoyeur de s'auto-valider
DROP POLICY IF EXISTS "Convoyeurs can manage own documents" ON public.documents_convoyeurs;

CREATE POLICY "Convoyeurs can read own documents"
ON public.documents_convoyeurs FOR SELECT TO authenticated
USING (convoyeur_id IN (SELECT id FROM public.convoyeurs WHERE user_id = auth.uid()));

CREATE POLICY "Convoyeurs can insert own documents"
ON public.documents_convoyeurs FOR INSERT TO authenticated
WITH CHECK (
  convoyeur_id IN (SELECT id FROM public.convoyeurs WHERE user_id = auth.uid())
  AND COALESCE(statut_validation, 'en_attente') = 'en_attente'
  AND valide_par IS NULL
  AND valide_le IS NULL
  AND motif_refus IS NULL
);

CREATE POLICY "Convoyeurs can delete own pending documents"
ON public.documents_convoyeurs FOR DELETE TO authenticated
USING (
  convoyeur_id IN (SELECT id FROM public.convoyeurs WHERE user_id = auth.uid())
  AND COALESCE(statut_validation, 'en_attente') = 'en_attente'
);

-- Pas d'UPDATE pour les convoyeurs : ils doivent supprimer + réuploader.
-- Validation reste réservée aux admins via la policy existante.

-- 2) mission_offres : bloquer la modification de is_winning par les convoyeurs
CREATE OR REPLACE FUNCTION public.protect_mission_offre_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.is_winning IS DISTINCT FROM OLD.is_winning THEN
    RAISE EXCEPTION 'Seul un administrateur peut désigner l''offre gagnante';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_mission_offre_admin_fields ON public.mission_offres;
CREATE TRIGGER trg_protect_mission_offre_admin_fields
BEFORE UPDATE ON public.mission_offres
FOR EACH ROW EXECUTE FUNCTION public.protect_mission_offre_admin_fields();

-- 3) b2b_fleet_leads / b2b_transport_requests : durcir insertions authentifiées
DROP POLICY IF EXISTS "Anyone can create fleet lead" ON public.b2b_fleet_leads;
CREATE POLICY "Public can create fleet lead"
ON public.b2b_fleet_leads FOR INSERT TO anon
WITH CHECK (
  estimated_vehicle_count >= 0
  AND length(COALESCE(description, '')) <= 5000
);
CREATE POLICY "Authenticated can create own fleet lead"
ON public.b2b_fleet_leads FOR INSERT TO authenticated
WITH CHECK (
  estimated_vehicle_count >= 0
  AND length(COALESCE(description, '')) <= 5000
  AND (
    company_id IS NULL
    OR company_id IN (
      SELECT c.id FROM public.companies c
      WHERE lower(c.contact_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    )
  )
);

DROP POLICY IF EXISTS "Anyone can create transport request" ON public.b2b_transport_requests;
CREATE POLICY "Public can create transport request"
ON public.b2b_transport_requests FOR INSERT TO anon
WITH CHECK (
  length(trim(pickup_address)) BETWEEN 1 AND 500
  AND length(trim(dropoff_address)) BETWEEN 1 AND 500
);
CREATE POLICY "Authenticated can create own transport request"
ON public.b2b_transport_requests FOR INSERT TO authenticated
WITH CHECK (
  length(trim(pickup_address)) BETWEEN 1 AND 500
  AND length(trim(dropoff_address)) BETWEEN 1 AND 500
  AND (
    company_id IS NULL
    OR company_id IN (
      SELECT c.id FROM public.companies c
      WHERE lower(c.contact_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    )
    OR (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()))
  )
);

-- 4) Retirer l'accès anon aux fonctions SECURITY DEFINER sensibles
REVOKE EXECUTE ON FUNCTION public.create_user_notification(uuid, text, text, text, text, text, text, text, text, uuid, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reapply_client_pricing_on_rule_change() FROM anon, PUBLIC;
