-- 1. client_default_addresses : email fallback uniquement sur fiches non rattachées
DROP POLICY IF EXISTS "Clients read own default addresses" ON public.client_default_addresses;
CREATE POLICY "Clients read own default addresses" ON public.client_default_addresses
FOR SELECT TO authenticated
USING (
  client_user_id = auth.uid()
  OR (client_user_id IS NULL AND auth_verified_email() IS NOT NULL AND lower(btrim(client_email)) = auth_verified_email())
);

DROP POLICY IF EXISTS "Clients update own default addresses" ON public.client_default_addresses;
CREATE POLICY "Clients update own default addresses" ON public.client_default_addresses
FOR UPDATE TO authenticated
USING (
  client_user_id = auth.uid()
  OR (client_user_id IS NULL AND auth_verified_email() IS NOT NULL AND lower(btrim(client_email)) = auth_verified_email())
)
WITH CHECK (
  client_user_id = auth.uid()
  OR (client_user_id IS NULL AND auth_verified_email() IS NOT NULL AND lower(btrim(client_email)) = auth_verified_email())
);

DROP POLICY IF EXISTS "Clients delete own default addresses" ON public.client_default_addresses;
CREATE POLICY "Clients delete own default addresses" ON public.client_default_addresses
FOR DELETE TO authenticated
USING (
  client_user_id = auth.uid()
  OR (client_user_id IS NULL AND auth_verified_email() IS NOT NULL AND lower(btrim(client_email)) = auth_verified_email())
);

DROP POLICY IF EXISTS "Clients insert own default addresses" ON public.client_default_addresses;
CREATE POLICY "Clients insert own default addresses" ON public.client_default_addresses
FOR INSERT TO authenticated
WITH CHECK (
  client_user_id = auth.uid()
  OR (client_user_id IS NULL AND auth_verified_email() IS NOT NULL AND lower(btrim(client_email)) = auth_verified_email())
);

-- 2. mission_offres : colonnes protégées côté convoyeur
CREATE OR REPLACE FUNCTION public.mission_offres_protect_convoyeur_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- champs réservés à l'administration : jamais modifiables par le convoyeur
  NEW.trajet_id := OLD.trajet_id;
  NEW.convoyeur_id := OLD.convoyeur_id;
  NEW.statut := OLD.statut;
  NEW.is_winning := OLD.is_winning;
  NEW.bid_round := OLD.bid_round;
  NEW.prix_suggere_snapshot := OLD.prix_suggere_snapshot;
  NEW.admin_counter_offer := OLD.admin_counter_offer;
  NEW.admin_counter_at := OLD.admin_counter_at;
  NEW.admin_counter_by := OLD.admin_counter_by;
  NEW.created_at := OLD.created_at;

  -- le prix proposé est figé dès qu'une contre-proposition admin existe
  IF OLD.admin_counter_at IS NOT NULL AND NEW.prix_propose IS DISTINCT FROM OLD.prix_propose THEN
    RAISE EXCEPTION 'Le prix ne peut plus être modifié après une contre-proposition';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mission_offres_protect_convoyeur_fields ON public.mission_offres;
CREATE TRIGGER mission_offres_protect_convoyeur_fields
BEFORE UPDATE ON public.mission_offres
FOR EACH ROW EXECUTE FUNCTION public.mission_offres_protect_convoyeur_fields();

-- 3. Logos outils externes : lecture restreinte
DROP POLICY IF EXISTS "outils_logos_read" ON storage.objects;
CREATE POLICY "outils_logos_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'outils-externes-logos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'convoyeur'::app_role)
  )
);

-- 4. Secret interne dédié aux tâches planifiées
INSERT INTO public.api_internal_config (key, value)
VALUES ('cron_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;
